import type { GameMode, QuestionType } from '../../../types/arena.ts';

/**
 * Module: Scoring (src/server/modules/scoring/scoringEngine.ts)
 * Server-authoritative score calculation. Never trusts client-provided points or timestamps.
 */

export interface ScoringModeConfig {
  mode: GameMode;
  label: string;
  guaranteedBaseRatio: number;
  speedBonusRatio: number;
  streakBonusPerStep: number;
  maxStreakBonus: number;
  specialMilestoneStreak: number;
  specialBonusPoints: number;
  wrongAnswerPenaltyPoints: number;
}

export const SCORING_MODE_CONFIGS: Record<GameMode, ScoringModeConfig> = {
  SPEED_PRECISION: {
    mode: 'SPEED_PRECISION',
    label: 'Tốc độ & Chính xác (Chuẩn Đấu trường)',
    guaranteedBaseRatio: 0.5,
    speedBonusRatio: 0.5,
    streakBonusPerStep: 100,
    maxStreakBonus: 300,
    specialMilestoneStreak: 3,
    specialBonusPoints: 50,
    wrongAnswerPenaltyPoints: 0,
  },
  STANDARD: {
    mode: 'STANDARD',
    label: 'Kiểm tra Tiêu chuẩn (Điểm cố định)',
    guaranteedBaseRatio: 1.0,
    speedBonusRatio: 0.0,
    streakBonusPerStep: 0,
    maxStreakBonus: 0,
    specialMilestoneStreak: 999,
    specialBonusPoints: 0,
    wrongAnswerPenaltyPoints: 0,
  },
  HIGH_STAKES: {
    mode: 'HIGH_STAKES',
    label: 'Thử thách Đỉnh cao (Thưởng lớn · Có trừ điểm sai)',
    guaranteedBaseRatio: 0.6,
    speedBonusRatio: 0.6,
    streakBonusPerStep: 150,
    maxStreakBonus: 450,
    specialMilestoneStreak: 2,
    specialBonusPoints: 100,
    wrongAnswerPenaltyPoints: 200,
  },
};

export interface ScoreCalculationInput {
  gameMode?: GameMode;
  questionType?: QuestionType;
  basePoints: number;
  timeLimitSec: number;
  questionStartedAtMs: number;
  answeredAtMs: number;
  selectedOptionIndex?: number;
  selectedOptionIndices?: number[];
  correctOptionIndex: number;
  correctOptionIndices?: number[];
  currentStreak: number;
}

export interface ScoreCalculationResult {
  isCorrect: boolean;
  responseTimeMs: number;
  baseEarnedPoints: number;
  speedBonusPoints: number;
  streakBonusPoints: number;
  specialBonusPoints: number;
  penaltyPoints: number;
  totalEarnedPoints: number;
  nextStreak: number;
}

export class ServerScoringEngine {
  public static evaluateCorrectness(input: {
    questionType?: QuestionType;
    selectedOptionIndex?: number;
    selectedOptionIndices?: number[];
    correctOptionIndex: number;
    correctOptionIndices?: number[];
  }): boolean {
    const qType = input.questionType || 'SINGLE_CHOICE';

    if (
      qType === 'MULTIPLE_CHOICE' &&
      Array.isArray(input.correctOptionIndices) &&
      input.correctOptionIndices.length > 0
    ) {
      const submitted = Array.isArray(input.selectedOptionIndices)
        ? Array.from(new Set(input.selectedOptionIndices)).sort((a, b) => a - b)
        : typeof input.selectedOptionIndex === 'number'
        ? [input.selectedOptionIndex]
        : [];
      const expected = Array.from(new Set(input.correctOptionIndices)).sort((a, b) => a - b);
      if (submitted.length !== expected.length) return false;
      return submitted.every((val, idx) => val === expected[idx]);
    }

    const chosen =
      typeof input.selectedOptionIndex === 'number'
        ? input.selectedOptionIndex
        : Array.isArray(input.selectedOptionIndices) && input.selectedOptionIndices.length > 0
        ? input.selectedOptionIndices[0]
        : -1;

    return chosen === input.correctOptionIndex;
  }

  public static calculateAnswerScore(input: ScoreCalculationInput): ScoreCalculationResult {
    const mode: GameMode = input.gameMode || 'SPEED_PRECISION';
    const cfg = SCORING_MODE_CONFIGS[mode] || SCORING_MODE_CONFIGS.SPEED_PRECISION;

    const responseTimeMs = Math.max(0, input.answeredAtMs - input.questionStartedAtMs);
    const maxWindowMs = Math.max(5000, input.timeLimitSec * 1000);
    const isWithinTime = responseTimeMs <= maxWindowMs + 1500; // 1.5s network grace buffer

    const isAnswerMatch = this.evaluateCorrectness({
      questionType: input.questionType,
      selectedOptionIndex: input.selectedOptionIndex,
      selectedOptionIndices: input.selectedOptionIndices,
      correctOptionIndex: input.correctOptionIndex,
      correctOptionIndices: input.correctOptionIndices,
    });

    const isCorrect = isWithinTime && isAnswerMatch;

    if (!isCorrect) {
      const penaltyPoints = cfg.wrongAnswerPenaltyPoints;
      return {
        isCorrect: false,
        responseTimeMs,
        baseEarnedPoints: 0,
        speedBonusPoints: 0,
        streakBonusPoints: 0,
        specialBonusPoints: 0,
        penaltyPoints,
        totalEarnedPoints: penaltyPoints > 0 ? -penaltyPoints : 0,
        nextStreak: 0,
      };
    }

    const clampedRatio = Math.max(0, Math.min(1, 1 - responseTimeMs / maxWindowMs));
    const baseEarnedPoints = Math.round(input.basePoints * cfg.guaranteedBaseRatio);
    const speedBonusPoints = Math.round(input.basePoints * cfg.speedBonusRatio * clampedRatio);
    const streakBonusPoints = Math.min(
      cfg.maxStreakBonus,
      input.currentStreak * cfg.streakBonusPerStep
    );

    const nextStreak = input.currentStreak + 1;
    let specialBonusPoints = 0;
    if (nextStreak >= cfg.specialMilestoneStreak) {
      specialBonusPoints += cfg.specialBonusPoints;
    }
    if (input.questionType === 'MULTIPLE_CHOICE') {
      specialBonusPoints += 50;
    }

    const totalEarnedPoints =
      baseEarnedPoints + speedBonusPoints + streakBonusPoints + specialBonusPoints;

    return {
      isCorrect: true,
      responseTimeMs,
      baseEarnedPoints,
      speedBonusPoints,
      streakBonusPoints,
      specialBonusPoints,
      penaltyPoints: 0,
      totalEarnedPoints,
      nextStreak,
    };
  }
}
