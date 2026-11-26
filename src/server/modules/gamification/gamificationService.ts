import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import type { IDataRepository } from '../../repository.ts';
import type {
  BadgeDefinitionRecord,
  BookmarkedQuestionRecord,
  ClassAssignmentRecord,
  ClassAssignmentSubmissionRecord,
  DailyChallengeInfo,
  FullQuestion,
  GameModeCardInfo,
  LearningMissionRecord,
  PublicQuestion,
  SoloOrPracticeResultSummary,
  SoloOrPracticeSessionPayload,
  TournamentRecord,
  TournamentRoundInfo,
  UserProfile,
  XpProfileSummary,
} from '../../../types/arena.ts';
import { ApiValidationError } from '../../middleware/validation.ts';
import { ServerScoringEngine } from '../scoring/scoringEngine.ts';

export interface MultiDimensionalLeaderboardRow {
  rank: number;
  userId: string;
  fullName: string;
  displayName: string;
  role: string;
  schoolName: string;
  className: string;
  matchScore: number;
  totalXp: number;
  level: number;
  levelTitle: string;
  achievementPoints: number;
  tournamentPoints: number;
  matchesPlayed: number;
  totalCorrect: number;
  accuracyPercent: number;
  badgeCount: number;
  primaryMetricValue: number;
  primaryMetricLabel: string;
}

export class GamificationAndModesService {
  private db: Database.Database;
  private repo: IDataRepository;

  constructor(repo: IDataRepository, dbPath?: string) {
    this.repo = repo;
    const resolvedPath = dbPath || path.resolve(process.cwd(), 'quizzi_arena.db');
    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchemaAndSeed();
  }

  private initSchemaAndSeed(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_xp_profiles (
        user_id TEXT PRIMARY KEY,
        total_xp INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 1,
        achievement_points INTEGER NOT NULL DEFAULT 0,
        tournament_points INTEGER NOT NULL DEFAULT 0,
        daily_streak INTEGER NOT NULL DEFAULT 0,
        last_daily_date TEXT NOT NULL DEFAULT '',
        practice_count INTEGER NOT NULL DEFAULT 0,
        speed_best_score INTEGER NOT NULL DEFAULT 0,
        title_equipped TEXT NOT NULL DEFAULT 'Tân binh Tri thức',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS xp_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_ref_id TEXT NOT NULL,
        xp_delta INTEGER NOT NULL DEFAULT 0,
        achievement_delta INTEGER NOT NULL DEFAULT 0,
        tournament_delta INTEGER NOT NULL DEFAULT 0,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(user_id, source_type, source_ref_id)
      );

      CREATE TABLE IF NOT EXISTS badge_definitions (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        icon_name TEXT NOT NULL,
        description TEXT NOT NULL,
        condition_type TEXT NOT NULL,
        condition_value INTEGER NOT NULL DEFAULT 1,
        xp_bonus INTEGER NOT NULL DEFAULT 50,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_badges (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        badge_code TEXT NOT NULL,
        unlocked_at TEXT NOT NULL,
        UNIQUE(user_id, badge_code)
      );

      CREATE TABLE IF NOT EXISTS learning_missions (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        mission_type TEXT NOT NULL,
        target_value INTEGER NOT NULL DEFAULT 1,
        xp_reward INTEGER NOT NULL DEFAULT 100,
        achievement_reward INTEGER NOT NULL DEFAULT 25,
        reward_title TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS user_mission_claims (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        mission_code TEXT NOT NULL,
        claimed_at TEXT NOT NULL,
        UNIQUE(user_id, mission_code)
      );

      CREATE TABLE IF NOT EXISTS practice_bookmarks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        question_id TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        UNIQUE(user_id, question_id)
      );

      CREATE TABLE IF NOT EXISTS solo_game_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        mode TEXT NOT NULL,
        title TEXT NOT NULL,
        question_set_id TEXT NOT NULL,
        question_set_title TEXT NOT NULL,
        subject TEXT NOT NULL DEFAULT '',
        grade_level TEXT NOT NULL DEFAULT '',
        reference_id TEXT NOT NULL DEFAULT '',
        round_number INTEGER NOT NULL DEFAULT 1,
        total_time_limit_sec INTEGER,
        per_question_time_sec INTEGER NOT NULL DEFAULT 20,
        show_explanation_immediately INTEGER NOT NULL DEFAULT 0,
        questions_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        total_score INTEGER NOT NULL DEFAULT 0,
        correct_count INTEGER NOT NULL DEFAULT 0,
        total_questions INTEGER NOT NULL DEFAULT 0,
        max_streak INTEGER NOT NULL DEFAULT 0,
        total_response_time_ms INTEGER NOT NULL DEFAULT 0,
        xp_earned INTEGER NOT NULL DEFAULT 0,
        started_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS class_assignments (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        classroom_id TEXT NOT NULL,
        classroom_name TEXT NOT NULL,
        teacher_id TEXT NOT NULL,
        teacher_name TEXT NOT NULL,
        question_set_id TEXT NOT NULL,
        question_set_title TEXT NOT NULL,
        mode_type TEXT NOT NULL DEFAULT 'TIMED_COMPETITION',
        open_at TEXT NOT NULL,
        close_at TEXT NOT NULL,
        max_attempts INTEGER NOT NULL DEFAULT 1,
        time_limit_sec INTEGER NOT NULL DEFAULT 600,
        is_published_results INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS class_assignment_submissions (
        id TEXT PRIMARY KEY,
        assignment_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        student_name TEXT NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 1,
        best_score INTEGER NOT NULL DEFAULT 0,
        correct_count INTEGER NOT NULL DEFAULT 0,
        total_questions INTEGER NOT NULL DEFAULT 0,
        total_time_ms INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'COMPLETED',
        submitted_at TEXT NOT NULL,
        UNIQUE(assignment_id, student_id)
      );

      CREATE TABLE IF NOT EXISTS daily_challenge_completions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        full_name TEXT NOT NULL,
        challenge_date TEXT NOT NULL,
        score INTEGER NOT NULL DEFAULT 0,
        correct_count INTEGER NOT NULL DEFAULT 0,
        total_questions INTEGER NOT NULL DEFAULT 0,
        completed_at TEXT NOT NULL,
        UNIQUE(user_id, challenge_date)
      );

      CREATE TABLE IF NOT EXISTS tournaments (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        classroom_id TEXT,
        classroom_name TEXT NOT NULL DEFAULT 'Toàn trường',
        creator_id TEXT NOT NULL,
        creator_name TEXT NOT NULL,
        current_round_number INTEGER NOT NULL DEFAULT 1,
        total_rounds INTEGER NOT NULL DEFAULT 3,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        rounds_json TEXT NOT NULL,
        champion_user_id TEXT,
        champion_name TEXT,
        created_at TEXT NOT NULL
      );
    `);

    this.seedBadgesAndMissions();
    this.seedSampleAssignmentAndTournamentIfEmpty();
  }

  private seedBadgesAndMissions(): void {
    const badges: Array<Omit<BadgeDefinitionRecord, 'unlocked' | 'unlockedAt'>> = [
      {
        id: 'badge_new_player',
        code: 'NEW_PLAYER',
        name: 'Người chơi mới',
        iconName: 'Sparkles',
        description: 'Hoàn thành trận thi đấu hoặc lượt luyện tập đầu tiên trên hệ thống.',
        conditionType: 'TOTAL_SESSIONS_COMPLETED',
        conditionValue: 1,
        xpBonus: 50,
      },
      {
        id: 'badge_knowledge_warrior',
        code: 'KNOWLEDGE_WARRIOR',
        name: 'Chiến binh tri thức',
        iconName: 'ShieldCheck',
        description: 'Trả lời chính xác tích lũy từ 15 câu hỏi trở lên.',
        conditionType: 'TOTAL_CORRECT_ANSWERS',
        conditionValue: 15,
        xpBonus: 120,
      },
      {
        id: 'badge_super_speed',
        code: 'SUPER_SPEED',
        name: 'Siêu tốc',
        iconName: 'Zap',
        description: 'Đạt điểm cao từ 300 điểm trở lên trong chế độ Thử thách thời gian hoặc trả lời trung bình dưới 4 giây.',
        conditionType: 'SPEED_CHALLENGE_SCORE',
        conditionValue: 300,
        xpBonus: 150,
      },
      {
        id: 'badge_precision_master',
        code: 'PRECISION_MASTER',
        name: 'Bậc thầy chính xác',
        iconName: 'Target',
        description: 'Đạt tỷ lệ chính xác tuyệt đối 100% trong một phiên thi đấu hoặc luyện tập (tối thiểu 3 câu).',
        conditionType: 'PERFECT_ACCURACY_SESSION',
        conditionValue: 100,
        xpBonus: 180,
      },
      {
        id: 'badge_win_streak',
        code: 'WIN_STREAK',
        name: 'Chuỗi chiến thắng',
        iconName: 'Flame',
        description: 'Đạt chuỗi trả lời đúng liên tiếp (Combo Streak) từ 4 câu trở lên hoặc chuỗi Daily Streak 3 ngày.',
        conditionType: 'MAX_COMBO_STREAK',
        conditionValue: 4,
        xpBonus: 140,
      },
      {
        id: 'badge_diligent_practice',
        code: 'DILIGENT_PRACTICE',
        name: 'Chăm chỉ luyện tập',
        iconName: 'BookOpenCheck',
        description: 'Hoàn thành từ 3 lượt Luyện tập tự do trở lên để củng cố kiến thức.',
        conditionType: 'FREE_PRACTICE_COUNT',
        conditionValue: 3,
        xpBonus: 160,
      },
      {
        id: 'badge_class_champion',
        code: 'CLASS_CHAMPION',
        name: 'Nhà vô địch lớp',
        iconName: 'Award',
        description: 'Đạt hạng 1 trong nhiệm vụ Thi đấu theo lớp hoặc phòng đấu trực tiếp.',
        conditionType: 'CLASS_OR_ROOM_FIRST_PLACE',
        conditionValue: 1,
        xpBonus: 250,
      },
      {
        id: 'badge_tournament_champion',
        code: 'TOURNAMENT_CHAMPION',
        name: 'Nhà vô địch giải đấu',
        iconName: 'Crown',
        description: 'Chiến thắng vòng Chung kết của một Giải đấu nhiều vòng.',
        conditionType: 'TOURNAMENT_WINNER',
        conditionValue: 1,
        xpBonus: 400,
      },
    ];

    const insertBadge = this.db.prepare(`
      INSERT OR IGNORE INTO badge_definitions (
        id, code, name, icon_name, description, condition_type, condition_value, xp_bonus, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    for (const b of badges) {
      insertBadge.run(
        b.id,
        b.code,
        b.name,
        b.iconName,
        b.description,
        b.conditionType,
        b.conditionValue,
        b.xpBonus,
        now
      );
    }

    const missions = [
      {
        id: 'mission_practice_1',
        code: 'COMPLETE_PRACTICE_SESSION',
        title: 'Khởi động tự giác',
        description: 'Hoàn thành ít nhất 1 bài Luyện tập tự do không áp lực thời gian.',
        missionType: 'COMPLETE_PRACTICE',
        targetValue: 1,
        xpReward: 80,
        achievementReward: 20,
        rewardTitle: 'Người học chủ động',
      },
      {
        id: 'mission_correct_10',
        code: 'ANSWER_10_CORRECT',
        title: 'Chinh phục 10 câu hỏi đúng',
        description: 'Tích lũy 10 câu trả lời chính xác ở bất kỳ chế độ chơi nào.',
        missionType: 'CORRECT_ANSWERS',
        targetValue: 10,
        xpReward: 120,
        achievementReward: 30,
        rewardTitle: 'Nhà thông thái trẻ',
      },
      {
        id: 'mission_join_match',
        code: 'JOIN_COMPETITIVE_MATCH',
        title: 'Bước vào đấu trường',
        description: 'Tham gia và hoàn thành ít nhất 1 trận thi đấu trực tiếp hoặc cá nhân.',
        missionType: 'JOIN_MATCH',
        targetValue: 1,
        xpReward: 100,
        achievementReward: 25,
        rewardTitle: 'Đấu sĩ Tri thức',
      },
      {
        id: 'mission_daily_challenge',
        code: 'COMPLETE_TODAY_DAILY',
        title: 'Thử thách mỗi ngày',
        description: 'Hoàn thành Thử thách hằng ngày hôm nay để duy trì chuỗi học tập.',
        missionType: 'COMPLETE_DAILY',
        targetValue: 1,
        xpReward: 150,
        achievementReward: 40,
        rewardTitle: 'Kiên trì bền bỉ',
      },
      {
        id: 'mission_reach_score_1000',
        code: 'REACH_1000_SCORE',
        title: 'Cột mốc 1.000 điểm',
        description: 'Đạt tổng điểm tích lũy các trận đấu từ 1.000 điểm trở lên.',
        missionType: 'REACH_SCORE',
        targetValue: 1000,
        xpReward: 200,
        achievementReward: 50,
        rewardTitle: 'Kiện tướng Đấu trường',
      },
    ];

    const insertMission = this.db.prepare(`
      INSERT OR IGNORE INTO learning_missions (
        id, code, title, description, mission_type, target_value, xp_reward, achievement_reward, reward_title
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const m of missions) {
      insertMission.run(
        m.id,
        m.code,
        m.title,
        m.description,
        m.missionType,
        m.targetValue,
        m.xpReward,
        m.achievementReward,
        m.rewardTitle
      );
    }
  }

  private seedSampleAssignmentAndTournamentIfEmpty(): void {
    const sets = this.repo.listQuestionSets();
    if (sets.length === 0) return;
    const defaultSet = sets[0];
    const secondSet = sets[1] || defaultSet;
    const thirdSet = sets[2] || defaultSet;

    const assignCount = (
      this.db.prepare('SELECT COUNT(*) as c FROM class_assignments').get() as { c: number }
    ).c;

    if (assignCount === 0) {
      const firstClass = this.db
        .prepare(
          `SELECT c.id, c.name, c.teacher_id as teacherId, COALESCE(u.full_name, 'Giáo viên chủ nhiệm') as teacherName
           FROM classrooms c
           LEFT JOIN users u ON u.id = c.teacher_id
           LIMIT 1`
        )
        .get() as { id: string; name: string; teacherId: string; teacherName: string } | undefined;
      if (firstClass) {
        const now = new Date();
        const openAt = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
        const closeAt = new Date(now.getTime() + 14 * 24 * 3600 * 1000).toISOString();
        this.db
          .prepare(
            `
          INSERT INTO class_assignments (
            id, title, description, classroom_id, classroom_name, teacher_id, teacher_name,
            question_set_id, question_set_title, mode_type, open_at, close_at, max_attempts,
            time_limit_sec, is_published_results, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            'assign_seed_1',
            `Đợt thi đua tuần: ${defaultSet.title}`,
            'Bài thi đua chính thức dành cho học sinh trong lớp để tổng kết điểm chuyên đề.',
            firstClass.id,
            firstClass.name,
            firstClass.teacherId,
            firstClass.teacherName,
            defaultSet.id,
            defaultSet.title,
            'TIMED_COMPETITION',
            openAt,
            closeAt,
            2,
            300,
            1,
            now.toISOString()
          );
      }
    }

    const tourCount = (
      this.db.prepare('SELECT COUNT(*) as c FROM tournaments').get() as { c: number }
    ).c;

    if (tourCount === 0) {
      const rounds: TournamentRoundInfo[] = [
        {
          roundNumber: 1,
          roundName: 'Vòng loại',
          questionSetId: defaultSet.id,
          questionSetTitle: defaultSet.title,
          questionCount: Math.min(5, defaultSet.questionCount || 5),
          timeLimitSec: 180,
          qualifyTopCount: 16,
          minScoreToAdvance: 100,
          status: 'OPEN',
          standings: [],
        },
        {
          roundNumber: 2,
          roundName: 'Bán kết',
          questionSetId: secondSet.id,
          questionSetTitle: secondSet.title,
          questionCount: Math.min(5, secondSet.questionCount || 5),
          timeLimitSec: 150,
          qualifyTopCount: 8,
          minScoreToAdvance: 200,
          status: 'PENDING',
          standings: [],
        },
        {
          roundNumber: 3,
          roundName: 'Chung kết',
          questionSetId: thirdSet.id,
          questionSetTitle: thirdSet.title,
          questionCount: Math.min(5, thirdSet.questionCount || 5),
          timeLimitSec: 120,
          qualifyTopCount: 1,
          minScoreToAdvance: 250,
          status: 'PENDING',
          standings: [],
        },
      ];

      this.db
        .prepare(
          `
        INSERT INTO tournaments (
          id, title, description, classroom_id, classroom_name, creator_id, creator_name,
          current_round_number, total_rounds, status, rounds_json, champion_user_id, champion_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          'tour_seed_1',
          'Giải Đấu Đỉnh Cao Tri Thức Mùa Xuân 2026',
          'Giải đấu 3 vòng chính thức: Vòng loại -> Bán kết -> Chung kết tìm kiếm Nhà vô địch giải đấu toàn trường.',
          null,
          'Toàn trường',
          'usr_teacher_1',
          'Thầy Nguyễn Hoàng Nam',
          1,
          3,
          'ACTIVE',
          JSON.stringify(rounds),
          null,
          null,
          new Date().toISOString()
        );
    }
  }

  public getLevelMetadata(totalXp: number): {
    level: number;
    levelTitle: string;
    levelBadgeCode: string;
    currentLevelXp: number;
    nextLevelXpRequired: number;
    progressPercent: number;
  } {
    // Progressive XP curve: Level 1 = 0..199, Level 2 = 200..499, Level 3 = 500..899, etc.
    const thresholds = [0, 200, 500, 900, 1400, 2000, 2750, 3600, 4600, 5800, 7200, 9000];
    const titles = [
      'Tân binh Tri thức',
      'Học giả Khởi đầu',
      'Chiến binh Tư duy',
      'Kiện tướng Đấu trường',
      'Bậc thầy Phản xạ',
      'Học giả Tinh anh',
      'Thủ lĩnh Học thuật',
      'Quán quân Tri thức',
      'Đại Kiện tướng',
      'Huyền thoại Quizzi',
      'Chúa tể Đấu trường',
      'Đỉnh cao Trí tuệ',
    ];

    let level = 1;
    for (let i = 0; i < thresholds.length; i++) {
      if (totalXp >= thresholds[i]) {
        level = i + 1;
      } else {
        break;
      }
    }

    const currentFloor = thresholds[Math.min(level - 1, thresholds.length - 1)] || 0;
    const nextCeiling =
      level <= thresholds.length - 1
        ? thresholds[level]
        : currentFloor + 2000 * (level - thresholds.length + 1);

    const currentLevelXp = Math.max(0, totalXp - currentFloor);
    const nextLevelXpRequired = Math.max(100, nextCeiling - currentFloor);
    const progressPercent = Math.min(
      100,
      Math.round((currentLevelXp / nextLevelXpRequired) * 100)
    );

    return {
      level,
      levelTitle: titles[Math.min(level - 1, titles.length - 1)],
      levelBadgeCode: `LV_${level}`,
      currentLevelXp,
      nextLevelXpRequired,
      progressPercent,
    };
  }

  private ensureXpProfileRow(userId: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
      INSERT OR IGNORE INTO user_xp_profiles (
        user_id, total_xp, level, achievement_points, tournament_points,
        daily_streak, last_daily_date, practice_count, speed_best_score, title_equipped, updated_at
      ) VALUES (?, 0, 1, 0, 0, 0, '', 0, 0, 'Tân binh Tri thức', ?)
    `
      )
      .run(userId, now);
  }

  public awardXpIdempotent(params: {
    userId: string;
    sourceType: string;
    sourceRefId: string;
    xpDelta: number;
    achievementDelta?: number;
    tournamentDelta?: number;
    reason: string;
  }): { awarded: boolean; leveledUp: boolean; newLevel: number } {
    this.ensureXpProfileRow(params.userId);
    const beforeRow = this.db
      .prepare('SELECT total_xp, level FROM user_xp_profiles WHERE user_id = ?')
      .get(params.userId) as { total_xp: number; level: number };

    const logId = `xplog_${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();
    const info = this.db
      .prepare(
        `
      INSERT OR IGNORE INTO xp_logs (
        id, user_id, source_type, source_ref_id, xp_delta, achievement_delta, tournament_delta, reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        logId,
        params.userId,
        params.sourceType,
        params.sourceRefId,
        Math.max(0, Math.round(params.xpDelta)),
        Math.max(0, Math.round(params.achievementDelta || 0)),
        Math.max(0, Math.round(params.tournamentDelta || 0)),
        params.reason,
        now
      );

    if (info.changes === 0) {
      return { awarded: false, leveledUp: false, newLevel: beforeRow.level };
    }

    const newTotalXp = beforeRow.total_xp + Math.max(0, Math.round(params.xpDelta));
    const meta = this.getLevelMetadata(newTotalXp);

    this.db
      .prepare(
        `
      UPDATE user_xp_profiles
      SET total_xp = ?,
          level = ?,
          achievement_points = achievement_points + ?,
          tournament_points = tournament_points + ?,
          updated_at = ?
      WHERE user_id = ?
    `
      )
      .run(
        newTotalXp,
        meta.level,
        Math.max(0, Math.round(params.achievementDelta || 0)),
        Math.max(0, Math.round(params.tournamentDelta || 0)),
        now,
        params.userId
      );

    return {
      awarded: true,
      leveledUp: meta.level > beforeRow.level,
      newLevel: meta.level,
    };
  }

  public evaluateAndUnlockBadges(
    userId: string,
    context?: {
      isFirstPlaceInRoomOrClass?: boolean;
      isTournamentChampion?: boolean;
      sessionAccuracyPercent?: number;
      sessionTotalQuestions?: number;
      sessionMaxStreak?: number;
      speedChallengeScore?: number;
    }
  ): BadgeDefinitionRecord[] {
    this.ensureXpProfileRow(userId);
    const definitions = this.listAllBadgeDefinitions(userId);
    const profile = this.db
      .prepare('SELECT * FROM user_xp_profiles WHERE user_id = ?')
      .get(userId) as any;

    const matchStats = this.db
      .prepare(
        `
      SELECT COUNT(*) as matchCount,
             COALESCE(SUM(correct_count), 0) as matchCorrect,
             COALESCE(MAX(max_streak), 0) as bestMatchStreak
      FROM match_participants
      WHERE user_id = ?
    `
      )
      .get(userId) as { matchCount: number; matchCorrect: number; bestMatchStreak: number };

    const soloStats = this.db
      .prepare(
        `
      SELECT COUNT(*) as soloCount,
             COALESCE(SUM(correct_count), 0) as soloCorrect,
             COALESCE(MAX(max_streak), 0) as bestSoloStreak
      FROM solo_game_sessions
      WHERE user_id = ? AND status = 'COMPLETED'
    `
      )
      .get(userId) as { soloCount: number; soloCorrect: number; bestSoloStreak: number };

    const totalSessions = (matchStats?.matchCount || 0) + (soloStats?.soloCount || 0);
    const totalCorrect = (matchStats?.matchCorrect || 0) + (soloStats?.soloCorrect || 0);
    const maxStreakEver = Math.max(
      matchStats?.bestMatchStreak || 0,
      soloStats?.bestSoloStreak || 0,
      context?.sessionMaxStreak || 0,
      profile?.daily_streak || 0
    );
    const bestSpeedScore = Math.max(
      profile?.speed_best_score || 0,
      context?.speedChallengeScore || 0
    );

    const newlyUnlocked: BadgeDefinitionRecord[] = [];
    const now = new Date().toISOString();

    for (const def of definitions) {
      if (def.unlocked) continue;
      let qualifies = false;

      if (def.conditionType === 'TOTAL_SESSIONS_COMPLETED') {
        qualifies = totalSessions >= def.conditionValue;
      } else if (def.conditionType === 'TOTAL_CORRECT_ANSWERS') {
        qualifies = totalCorrect >= def.conditionValue;
      } else if (def.conditionType === 'SPEED_CHALLENGE_SCORE') {
        qualifies = bestSpeedScore >= def.conditionValue;
      } else if (def.conditionType === 'PERFECT_ACCURACY_SESSION') {
        qualifies =
          (context?.sessionTotalQuestions || 0) >= 3 &&
          (context?.sessionAccuracyPercent || 0) >= def.conditionValue;
      } else if (def.conditionType === 'MAX_COMBO_STREAK') {
        qualifies = maxStreakEver >= def.conditionValue;
      } else if (def.conditionType === 'FREE_PRACTICE_COUNT') {
        qualifies = (profile?.practice_count || 0) >= def.conditionValue;
      } else if (def.conditionType === 'CLASS_OR_ROOM_FIRST_PLACE') {
        qualifies = Boolean(context?.isFirstPlaceInRoomOrClass);
      } else if (def.conditionType === 'TOURNAMENT_WINNER') {
        qualifies = Boolean(context?.isTournamentChampion);
      }

      if (qualifies) {
        const res = this.db
          .prepare(
            `
          INSERT OR IGNORE INTO user_badges (id, user_id, badge_code, unlocked_at)
          VALUES (?, ?, ?, ?)
        `
          )
          .run(`ub_${crypto.randomBytes(6).toString('hex')}`, userId, def.code, now);

        if (res.changes > 0) {
          this.awardXpIdempotent({
            userId,
            sourceType: 'BADGE_UNLOCK',
            sourceRefId: def.code,
            xpDelta: def.xpBonus,
            achievementDelta: 50,
            reason: `Mở khóa huy hiệu "${def.name}"`,
          });
          newlyUnlocked.push({
            ...def,
            unlocked: true,
            unlockedAt: now,
          });
        }
      }
    }

    return newlyUnlocked;
  }

  public handleLiveMatchCompletion(payload: {
    roomId: string;
    sessionId: string;
    roomCode: string;
    roomTitle: string;
    questionSetId: string;
    classroomId: string | null;
    isTeamMode: boolean;
    totalQuestions: number;
    participants: Array<{
      userId: string;
      displayName: string;
      role: string;
      score: number;
      correctCount: number;
      maxStreak: number;
      avgResponseTimeMs: number;
      teamId: string | null;
    }>;
  }): void {
    const sorted = [...payload.participants].sort((a, b) => b.score - a.score);
    sorted.forEach((p, idx) => {
      const rank = idx + 1;
      const xpFromCorrect = p.correctCount * 15;
      const xpRankBonus = rank === 1 ? 60 : rank === 2 ? 35 : rank === 3 ? 20 : 10;
      const totalXpDelta = xpFromCorrect + xpRankBonus;
      const achievementDelta = rank === 1 ? 30 : 10;

      this.awardXpIdempotent({
        userId: p.userId,
        sourceType: 'LIVE_MATCH',
        sourceRefId: payload.sessionId,
        xpDelta: totalXpDelta,
        achievementDelta,
        reason: `Hoàn thành phòng thi đấu "${payload.roomTitle}" (Hạng #${rank})`,
      });

      const accuracy =
        payload.totalQuestions > 0
          ? Math.round((p.correctCount / payload.totalQuestions) * 100)
          : 0;

      this.evaluateAndUnlockBadges(p.userId, {
        isFirstPlaceInRoomOrClass: rank === 1 && sorted.length >= 1,
        sessionAccuracyPercent: accuracy,
        sessionTotalQuestions: payload.totalQuestions,
        sessionMaxStreak: p.maxStreak,
      });
    });
  }

  /**
   * Section II: Game Center - 8 Game Modes Catalog
   */
  public getGameCenterModes(): GameModeCardInfo[] {
    return [
      {
        id: 'LIVE_ARENA',
        title: '1. Đấu trường trực tiếp',
        subtitle: 'Thời gian thực đa người chơi',
        description:
          'Thi đấu trực tiếp bằng mã PIN phòng cùng cả lớp với bảng xếp hạng biến động tức thời sau từng câu hỏi.',
        iconName: 'Swords',
        accentColor: 'indigo',
        supportedPlayersLabel: '2 – 100 người chơi đồng thời',
        estimatedDurationLabel: '5 – 20 phút',
        status: 'AVAILABLE',
        teacherControlled: true,
        actionLabel: 'Vào Đấu trường PIN',
      },
      {
        id: 'SOLO_COMPETITIVE',
        title: '2. Thi đấu cá nhân',
        subtitle: 'Tự chọn chuyên đề & độ khó',
        description:
          'Học sinh chủ động chọn môn học, khối lớp, bộ đề và độ khó để thi đấu tính điểm chuẩn xác trên máy chủ.',
        iconName: 'UserCheck',
        accentColor: 'emerald',
        supportedPlayersLabel: '1 người chơi (Cá nhân)',
        estimatedDurationLabel: '3 – 10 phút',
        status: 'AVAILABLE',
        teacherControlled: true,
        actionLabel: 'Bắt đầu Thi đấu Cá nhân',
      },
      {
        id: 'TEAM_ARENA',
        title: '3. Thi đấu theo đội',
        subtitle: '4 cơ chế phối hợp đồng đội',
        description:
          'Chia đội thông minh hoặc thủ công. Hỗ trợ Cộng tổng chuẩn hóa, Đội trưởng đại diện, Luân phiên và Đồng thuận đội.',
        iconName: 'Users',
        accentColor: 'violet',
        supportedPlayersLabel: '2 – 8 đội (Tối đa 100 học sinh)',
        estimatedDurationLabel: '10 – 25 phút',
        status: 'AVAILABLE',
        teacherControlled: true,
        actionLabel: 'Tạo / Vào Đấu Đội',
      },
      {
        id: 'FREE_PRACTICE',
        title: '4. Luyện tập tự do',
        subtitle: 'Không áp lực – Xem giải thích ngay',
        description:
          'Không giới hạn thời gian bắt buộc, xem đáp án và lời giải chi tiết ngay sau từng câu, đánh dấu câu hỏi khó.',
        iconName: 'BookOpen',
        accentColor: 'teal',
        supportedPlayersLabel: '1 người học tự chủ',
        estimatedDurationLabel: 'Tự do (5 – 30 phút)',
        status: 'AVAILABLE',
        teacherControlled: true,
        actionLabel: 'Vào Luyện tập Tự do',
      },
      {
        id: 'SPEED_CHALLENGE',
        title: '5. Thử thách thời gian',
        subtitle: 'Đua tốc độ & Chuỗi Combo',
        description:
          'Trả lời liên tục tối đa số câu hỏi trong tổng quỹ thời gian giới hạn. Điểm thưởng tăng mạnh theo tốc độ và chuỗi đúng.',
        iconName: 'Timer',
        accentColor: 'amber',
        supportedPlayersLabel: '1 người chơi (Đua kỷ lục)',
        estimatedDurationLabel: '60 – 180 giây',
        status: 'AVAILABLE',
        teacherControlled: true,
        actionLabel: 'Đua Thử thách Thời gian',
      },
      {
        id: 'CLASS_COMPETITION',
        title: '6. Thi đấu theo lớp',
        subtitle: 'Nhiệm vụ giáo viên giao cho lớp',
        description:
          'Giáo viên giao bộ câu hỏi cho lớp với thời gian mở/đóng, giới hạn số lần làm bài và công bố bảng vàng của lớp.',
        iconName: 'GraduationCap',
        accentColor: 'blue',
        supportedPlayersLabel: 'Toàn bộ học sinh trong lớp',
        estimatedDurationLabel: 'Theo lịch Giáo viên giao',
        status: 'AVAILABLE',
        teacherControlled: true,
        actionLabel: 'Xem Nhiệm vụ Lớp học',
      },
      {
        id: 'DAILY_CHALLENGE',
        title: '7. Thử thách hằng ngày',
        subtitle: 'Duy trì chuỗi ngày học tập (Streak)',
        description:
          'Mỗi ngày một bộ câu hỏi thử thách mới. Đạt điểm mục tiêu để nhận thưởng XP và nối dài chuỗi ngày học liên tiếp.',
        iconName: 'CalendarCheck',
        accentColor: 'rose',
        supportedPlayersLabel: 'Toàn trường (Mỗi ngày 1 lượt thưởng)',
        estimatedDurationLabel: '3 – 5 phút / ngày',
        status: 'AVAILABLE',
        teacherControlled: true,
        actionLabel: 'Chinh phục Hôm nay',
      },
      {
        id: 'TOURNAMENT',
        title: '8. Giải đấu nhiều vòng',
        subtitle: 'Vòng loại • Bán kết • Chung kết',
        description:
          'Hệ thống giải đấu học thuật chuyên nghiệp gồm 3 vòng tranh tài để tìm ra Nhà vô địch giải đấu toàn trường.',
        iconName: 'Trophy',
        accentColor: 'orange',
        supportedPlayersLabel: 'Nhiều vòng đấu loại trực tiếp',
        estimatedDurationLabel: '3 vòng thi đấu',
        status: 'AVAILABLE',
        teacherControlled: true,
        actionLabel: 'Vào Sảnh Giải đấu',
      },
    ];
  }

  public getUserXpProfile(userId: string): XpProfileSummary {
    this.ensureXpProfileRow(userId);
    const row = this.db
      .prepare('SELECT * FROM user_xp_profiles WHERE user_id = ?')
      .get(userId) as any;

    const meta = this.getLevelMetadata(row.total_xp || 0);
    const logs = this.db
      .prepare(
        `
      SELECT id, source_type as sourceType, xp_delta as xpDelta,
             achievement_delta as achievementDelta, reason, created_at as createdAt
      FROM xp_logs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 15
    `
      )
      .all(userId) as XpProfileSummary['recentXpLogs'];

    return {
      userId,
      totalXp: row.total_xp || 0,
      level: meta.level,
      levelTitle: meta.levelTitle,
      levelBadgeCode: meta.levelBadgeCode,
      currentLevelXp: meta.currentLevelXp,
      nextLevelXpRequired: meta.nextLevelXpRequired,
      progressPercent: meta.progressPercent,
      achievementPoints: row.achievement_points || 0,
      tournamentPoints: row.tournament_points || 0,
      dailyStreak: row.daily_streak || 0,
      practiceCount: row.practice_count || 0,
      speedChallengeBestScore: row.speed_best_score || 0,
      titleEquipped: row.title_equipped || meta.levelTitle,
      recentXpLogs: logs,
    };
  }

  public listAllBadgeDefinitions(userId?: string): BadgeDefinitionRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM badge_definitions ORDER BY xp_bonus ASC')
      .all() as any[];

    const unlockedMap = new Map<string, string>();
    if (userId) {
      const uRows = this.db
        .prepare('SELECT badge_code, unlocked_at FROM user_badges WHERE user_id = ?')
        .all(userId) as Array<{ badge_code: string; unlocked_at: string }>;
      for (const r of uRows) {
        unlockedMap.set(r.badge_code, r.unlocked_at);
      }
    }

    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      iconName: r.icon_name,
      description: r.description,
      conditionType: r.condition_type,
      conditionValue: r.condition_value,
      xpBonus: r.xp_bonus,
      unlocked: unlockedMap.has(r.code),
      unlockedAt: unlockedMap.get(r.code) || null,
    }));
  }

  public updateBadgeDefinitionByAdmin(
    badgeCode: string,
    updates: {
      name?: string;
      description?: string;
      conditionValue?: number;
      xpBonus?: number;
    }
  ): BadgeDefinitionRecord {
    const existing = this.db
      .prepare('SELECT * FROM badge_definitions WHERE code = ?')
      .get(badgeCode) as any;
    if (!existing) {
      throw new ApiValidationError('Không tìm thấy huy hiệu cần cập nhật.', 404);
    }

    const newName = updates.name?.trim() || existing.name;
    const newDesc = updates.description?.trim() || existing.description;
    const newCondVal =
      typeof updates.conditionValue === 'number' && updates.conditionValue >= 1
        ? Math.round(updates.conditionValue)
        : existing.condition_value;
    const newXp =
      typeof updates.xpBonus === 'number' && updates.xpBonus >= 10
        ? Math.round(updates.xpBonus)
        : existing.xp_bonus;

    this.db
      .prepare(
        `
      UPDATE badge_definitions
      SET name = ?, description = ?, condition_value = ?, xp_bonus = ?
      WHERE code = ?
    `
      )
      .run(newName, newDesc, newCondVal, newXp, badgeCode);

    return this.listAllBadgeDefinitions().find((b) => b.code === badgeCode)!;
  }

  public getUserMissions(userId: string): LearningMissionRecord[] {
    this.ensureXpProfileRow(userId);
    const profile = this.db
      .prepare('SELECT * FROM user_xp_profiles WHERE user_id = ?')
      .get(userId) as any;

    const matchStats = this.db
      .prepare(
        `
      SELECT COUNT(*) as matchCount,
             COALESCE(SUM(correct_count), 0) as matchCorrect,
             COALESCE(SUM(score), 0) as matchScore
      FROM match_participants
      WHERE user_id = ?
    `
      )
      .get(userId) as { matchCount: number; matchCorrect: number; matchScore: number };

    const soloStats = this.db
      .prepare(
        `
      SELECT COUNT(*) as soloCount,
             COALESCE(SUM(correct_count), 0) as soloCorrect,
             COALESCE(SUM(total_score), 0) as soloScore
      FROM solo_game_sessions
      WHERE user_id = ? AND status = 'COMPLETED'
    `
      )
      .get(userId) as { soloCount: number; soloCorrect: number; soloScore: number };

    const todayStr = new Date().toISOString().slice(0, 10);
    const dailyDoneToday = (
      this.db
        .prepare(
          'SELECT COUNT(*) as c FROM daily_challenge_completions WHERE user_id = ? AND challenge_date = ?'
        )
        .get(userId, todayStr) as { c: number }
    ).c;

    const claims = new Set<string>(
      (
        this.db
          .prepare('SELECT mission_code FROM user_mission_claims WHERE user_id = ?')
          .all(userId) as Array<{ mission_code: string }>
      ).map((r) => r.mission_code)
    );

    const rows = this.db.prepare('SELECT * FROM learning_missions').all() as any[];

    const totalCorrect = (matchStats?.matchCorrect || 0) + (soloStats?.soloCorrect || 0);
    const totalScore = (matchStats?.matchScore || 0) + (soloStats?.soloScore || 0);
    const totalMatches = (matchStats?.matchCount || 0) + (soloStats?.soloCount || 0);

    return rows.map((m) => {
      let currentVal = 0;
      if (m.mission_type === 'COMPLETE_PRACTICE') {
        currentVal = profile?.practice_count || 0;
      } else if (m.mission_type === 'CORRECT_ANSWERS') {
        currentVal = totalCorrect;
      } else if (m.mission_type === 'JOIN_MATCH') {
        currentVal = totalMatches;
      } else if (m.mission_type === 'COMPLETE_DAILY') {
        currentVal = dailyDoneToday > 0 ? 1 : 0;
      } else if (m.mission_type === 'REACH_SCORE') {
        currentVal = totalScore;
      }

      const isCompleted = currentVal >= m.target_value;
      return {
        id: m.id,
        code: m.code,
        title: m.title,
        description: m.description,
        missionType: m.mission_type,
        targetValue: m.target_value,
        currentValue: Math.min(m.target_value, currentVal),
        xpReward: m.xp_reward,
        achievementReward: m.achievement_reward,
        rewardTitle: m.reward_title,
        isCompleted,
        isClaimed: claims.has(m.code),
      };
    });
  }

  public claimMissionReward(
    userId: string,
    missionCode: string
  ): {
    mission: LearningMissionRecord;
    xpProfile: XpProfileSummary;
  } {
    const missions = this.getUserMissions(userId);
    const target = missions.find((m) => m.code === missionCode);
    if (!target) {
      throw new ApiValidationError('Không tìm thấy nhiệm vụ học tập.', 404);
    }
    if (!target.isCompleted) {
      throw new ApiValidationError('Bạn chưa hoàn thành đủ chỉ tiêu của nhiệm vụ này.', 400);
    }
    if (target.isClaimed) {
      throw new ApiValidationError('Bạn đã nhận thưởng nhiệm vụ này rồi.', 409);
    }

    const now = new Date().toISOString();
    const res = this.db
      .prepare(
        `
      INSERT OR IGNORE INTO user_mission_claims (id, user_id, mission_code, claimed_at)
      VALUES (?, ?, ?, ?)
    `
      )
      .run(`mc_${crypto.randomBytes(6).toString('hex')}`, userId, missionCode, now);

    if (res.changes === 0) {
      throw new ApiValidationError('Nhiệm vụ này đã được nhận thưởng trước đó.', 409);
    }

    this.awardXpIdempotent({
      userId,
      sourceType: 'LEARNING_MISSION',
      sourceRefId: missionCode,
      xpDelta: target.xpReward,
      achievementDelta: target.achievementReward,
      reason: `Hoàn thành nhiệm vụ "${target.title}"`,
    });

    if (target.rewardTitle) {
      this.db
        .prepare('UPDATE user_xp_profiles SET title_equipped = ?, updated_at = ? WHERE user_id = ?')
        .run(target.rewardTitle, now, userId);
    }

    return {
      mission: { ...target, isClaimed: true },
      xpProfile: this.getUserXpProfile(userId),
    };
  }

  /**
   * Section VI: Practice Bookmarks (Đánh dấu câu hỏi khó)
   */
  public toggleBookmarkQuestion(
    userId: string,
    questionId: string,
    note?: string
  ): { bookmarked: boolean; bookmarks: BookmarkedQuestionRecord[] } {
    const q = this.repo.getQuestionById(questionId);
    if (!q) {
      throw new ApiValidationError('Không tìm thấy câu hỏi trong ngân hàng.', 404);
    }

    const existing = this.db
      .prepare('SELECT id FROM practice_bookmarks WHERE user_id = ? AND question_id = ?')
      .get(userId, questionId) as { id: string } | undefined;

    if (existing && note === undefined) {
      this.db
        .prepare('DELETE FROM practice_bookmarks WHERE user_id = ? AND question_id = ?')
        .run(userId, questionId);
      return { bookmarked: false, bookmarks: this.listBookmarkedQuestions(userId) };
    }

    const now = new Date().toISOString();
    this.db
      .prepare(
        `
      INSERT INTO practice_bookmarks (id, user_id, question_id, note, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, question_id) DO UPDATE SET note = excluded.note
    `
      )
      .run(
        `bm_${crypto.randomBytes(6).toString('hex')}`,
        userId,
        questionId,
        (note || 'Câu hỏi cần ôn tập kỹ hơn').trim(),
        now
      );

    return { bookmarked: true, bookmarks: this.listBookmarkedQuestions(userId) };
  }

  public listBookmarkedQuestions(userId: string): BookmarkedQuestionRecord[] {
    const rows = this.db
      .prepare(
        'SELECT question_id, note, created_at FROM practice_bookmarks WHERE user_id = ? ORDER BY created_at DESC'
      )
      .all(userId) as Array<{ question_id: string; note: string; created_at: string }>;

    const result: BookmarkedQuestionRecord[] = [];
    for (const r of rows) {
      const q = this.repo.getQuestionById(r.question_id);
      if (q) {
        result.push({
          questionId: q.id,
          questionCode: q.questionCode || q.id,
          prompt: q.prompt,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          subject: q.subject || 'Tổng hợp',
          topic: q.topic || 'Chuyên đề',
          note: r.note,
          createdAt: r.created_at,
        });
      }
    }
    return result;
  }

  /**
   * Section IX: Daily Challenge (Thử thách hằng ngày)
   */
  public getDailyChallengeInfo(user: UserProfile): DailyChallengeInfo {
    const todayStr = new Date().toISOString().slice(0, 10);
    const sets = this.repo.listQuestionSets();
    if (sets.length === 0) {
      throw new ApiValidationError('Hệ thống chưa có bộ câu hỏi nào.', 400);
    }

    // Deterministically pick today's question set by hashing YYYY-MM-DD
    const dateHash = todayStr
      .split('')
      .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const chosenSet = sets[dateHash % sets.length];

    this.ensureXpProfileRow(user.id);
    const profile = this.db
      .prepare('SELECT daily_streak FROM user_xp_profiles WHERE user_id = ?')
      .get(user.id) as { daily_streak: number };

    const myToday = this.db
      .prepare(
        'SELECT score, correct_count FROM daily_challenge_completions WHERE user_id = ? AND challenge_date = ?'
      )
      .get(user.id, todayStr) as { score: number; correct_count: number } | undefined;

    const topToday = this.db
      .prepare(
        `
      SELECT user_id as userId, full_name as fullName, score, correct_count as correctCount, completed_at as completedAt
      FROM daily_challenge_completions
      WHERE challenge_date = ?
      ORDER BY score DESC, correct_count DESC, completed_at ASC
      LIMIT 10
    `
      )
      .all(todayStr) as DailyChallengeInfo['topCompletionsToday'];

    return {
      challengeDate: todayStr,
      title: `Thử thách Ngày ${todayStr}: ${chosenSet.title}`,
      subject: chosenSet.subject || 'Tổng hợp',
      questionSetId: chosenSet.id,
      questionCount: Math.min(5, chosenSet.questionCount || 5),
      targetScore: 300,
      xpReward: 150,
      achievementPointsReward: 40,
      alreadyCompletedToday: Boolean(myToday),
      currentDailyStreak: profile?.daily_streak || 0,
      todayScore: myToday ? myToday.score : null,
      todayCorrectCount: myToday ? myToday.correct_count : null,
      topCompletionsToday: topToday,
    };
  }

  /**
   * Section VIII: Class Competition (Thi đấu theo lớp)
   */
  public listClassAssignments(user: UserProfile, classroomId?: string): ClassAssignmentRecord[] {
    let rows: any[];
    if (classroomId) {
      rows = this.db
        .prepare('SELECT * FROM class_assignments WHERE classroom_id = ? ORDER BY created_at DESC')
        .all(classroomId) as any[];
    } else {
      rows = this.db
        .prepare('SELECT * FROM class_assignments ORDER BY created_at DESC')
        .all() as any[];
    }

    const nowMs = Date.now();
    return rows.map((r) => {
      const openMs = new Date(r.open_at).getTime();
      const closeMs = new Date(r.close_at).getTime();
      const status: 'UPCOMING' | 'OPEN' | 'CLOSED' =
        nowMs < openMs ? 'UPCOMING' : nowMs > closeMs ? 'CLOSED' : 'OPEN';

      const subCount = (
        this.db
          .prepare('SELECT COUNT(*) as c FROM class_assignment_submissions WHERE assignment_id = ?')
          .get(r.id) as { c: number }
      ).c;

      const mySub = this.db
        .prepare(
          'SELECT attempt_count, best_score FROM class_assignment_submissions WHERE assignment_id = ? AND student_id = ?'
        )
        .get(r.id, user.id) as { attempt_count: number; best_score: number } | undefined;

      const cls = this.repo.getClassroomById(r.classroom_id);

      return {
        id: r.id,
        title: r.title,
        description: r.description,
        classroomId: r.classroom_id,
        classroomName: r.classroom_name,
        teacherId: r.teacher_id,
        teacherName: r.teacher_name,
        questionSetId: r.question_set_id,
        questionSetTitle: r.question_set_title,
        modeType: r.mode_type,
        openAt: r.open_at,
        closeAt: r.close_at,
        maxAttempts: r.max_attempts,
        timeLimitSec: r.time_limit_sec,
        isPublishedResults: Boolean(r.is_published_results),
        status,
        participantCount: subCount,
        totalStudentsInClass: cls?.studentCount || Math.max(subCount, 1),
        myAttemptsCount: mySub?.attempt_count || 0,
        myBestScore: mySub ? mySub.best_score : null,
        createdAt: r.created_at,
      };
    });
  }

  public createClassAssignment(
    actor: UserProfile,
    params: {
      title: string;
      description?: string;
      classroomId: string;
      questionSetId: string;
      modeType?: 'PRACTICE' | 'TIMED_COMPETITION';
      openAt?: string;
      closeAt?: string;
      maxAttempts?: number;
      timeLimitSec?: number;
      isPublishedResults?: boolean;
    }
  ): ClassAssignmentRecord {
    if (actor.role === 'STUDENT') {
      throw new ApiValidationError('Chỉ Giáo viên hoặc Quản trị viên mới được giao bài thi đấu cho lớp.', 403);
    }

    const cls = this.repo.getClassroomById(params.classroomId);
    if (!cls) {
      throw new ApiValidationError('Không tìm thấy lớp học được chọn.', 404);
    }
    const qSet = this.repo.getQuestionSetById(params.questionSetId);
    if (!qSet) {
      throw new ApiValidationError('Không tìm thấy bộ câu hỏi được chọn.', 404);
    }

    const now = new Date();
    const id = `assign_${crypto.randomBytes(6).toString('hex')}`;
    const openAt = params.openAt || now.toISOString();
    const closeAt =
      params.closeAt || new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();

    this.db
      .prepare(
        `
      INSERT INTO class_assignments (
        id, title, description, classroom_id, classroom_name, teacher_id, teacher_name,
        question_set_id, question_set_title, mode_type, open_at, close_at, max_attempts,
        time_limit_sec, is_published_results, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        (params.title || `Thi đua lớp ${cls.name}: ${qSet.title}`).trim(),
        (params.description || 'Hoàn thành đúng hạn để ghi danh bảng xếp hạng lớp.').trim(),
        cls.id,
        cls.name,
        actor.id,
        actor.fullName,
        qSet.id,
        qSet.title,
        params.modeType === 'PRACTICE' ? 'PRACTICE' : 'TIMED_COMPETITION',
        openAt,
        closeAt,
        Math.max(1, Math.min(10, Number(params.maxAttempts) || 2)),
        Math.max(60, Math.min(3600, Number(params.timeLimitSec) || 300)),
        params.isPublishedResults === false ? 0 : 1,
        now.toISOString()
      );

    return this.listClassAssignments(actor).find((a) => a.id === id)!;
  }

  public getClassAssignmentStandings(assignmentId: string): ClassAssignmentSubmissionRecord[] {
    const rows = this.db
      .prepare(
        `
      SELECT id, assignment_id as assignmentId, student_id as studentId,
             student_name as studentName, attempt_count as attemptCount,
             best_score as bestScore, correct_count as correctCount,
             total_questions as totalQuestions, total_time_ms as totalTimeMs,
             status, submitted_at as submittedAt
      FROM class_assignment_submissions
      WHERE assignment_id = ?
      ORDER BY best_score DESC, correct_count DESC, total_time_ms ASC
    `
      )
      .all(assignmentId) as ClassAssignmentSubmissionRecord[];
    return rows;
  }

  public toggleAssignmentResultsPublish(
    actor: UserProfile,
    assignmentId: string,
    isPublished: boolean
  ): ClassAssignmentRecord {
    if (actor.role === 'STUDENT') {
      throw new ApiValidationError('Chỉ Giáo viên mới có quyền công bố kết quả lớp.', 403);
    }
    this.db
      .prepare('UPDATE class_assignments SET is_published_results = ? WHERE id = ?')
      .run(isPublished ? 1 : 0, assignmentId);
    const updated = this.listClassAssignments(actor).find((a) => a.id === assignmentId);
    if (!updated) {
      throw new ApiValidationError('Không tìm thấy nhiệm vụ lớp học.', 404);
    }
    return updated;
  }

  /**
   * Section X: Multi-Round Tournaments (Giải đấu nhiều vòng)
   */
  public listTournaments(): TournamentRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM tournaments ORDER BY created_at DESC')
      .all() as any[];

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      classroomId: r.classroom_id,
      classroomName: r.classroom_name,
      creatorId: r.creator_id,
      creatorName: r.creator_name,
      currentRoundNumber: r.current_round_number,
      totalRounds: r.total_rounds,
      status: r.status,
      rounds: JSON.parse(r.rounds_json || '[]'),
      championUserId: r.champion_user_id,
      championName: r.champion_name,
      createdAt: r.created_at,
    }));
  }

  public createTournament(
    actor: UserProfile,
    params: {
      title: string;
      description?: string;
      classroomId?: string | null;
      roundQuestionSetIds?: string[];
      qualifyRound1?: number;
      qualifyRound2?: number;
    }
  ): TournamentRecord {
    if (actor.role === 'STUDENT') {
      throw new ApiValidationError('Chỉ Giáo viên hoặc Quản trị viên mới được tạo giải đấu.', 403);
    }

    const sets = this.repo.listQuestionSets();
    if (sets.length === 0) {
      throw new ApiValidationError('Cần ít nhất 1 bộ câu hỏi để tạo giải đấu.', 400);
    }

    const set1 =
      this.repo.getQuestionSetById(params.roundQuestionSetIds?.[0] || '') || sets[0];
    const set2 =
      this.repo.getQuestionSetById(params.roundQuestionSetIds?.[1] || '') ||
      sets[1] ||
      sets[0];
    const set3 =
      this.repo.getQuestionSetById(params.roundQuestionSetIds?.[2] || '') ||
      sets[2] ||
      sets[0];

    const cls = params.classroomId ? this.repo.getClassroomById(params.classroomId) : null;

    const rounds: TournamentRoundInfo[] = [
      {
        roundNumber: 1,
        roundName: 'Vòng loại',
        questionSetId: set1.id,
        questionSetTitle: set1.title,
        questionCount: Math.min(5, set1.questionCount || 5),
        timeLimitSec: 180,
        qualifyTopCount: Math.max(2, Number(params.qualifyRound1) || 8),
        minScoreToAdvance: 100,
        status: 'OPEN',
        standings: [],
      },
      {
        roundNumber: 2,
        roundName: 'Bán kết',
        questionSetId: set2.id,
        questionSetTitle: set2.title,
        questionCount: Math.min(5, set2.questionCount || 5),
        timeLimitSec: 150,
        qualifyTopCount: Math.max(1, Number(params.qualifyRound2) || 4),
        minScoreToAdvance: 150,
        status: 'PENDING',
        standings: [],
      },
      {
        roundNumber: 3,
        roundName: 'Chung kết',
        questionSetId: set3.id,
        questionSetTitle: set3.title,
        questionCount: Math.min(5, set3.questionCount || 5),
        timeLimitSec: 120,
        qualifyTopCount: 1,
        minScoreToAdvance: 200,
        status: 'PENDING',
        standings: [],
      },
    ];

    const id = `tour_${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
      INSERT INTO tournaments (
        id, title, description, classroom_id, classroom_name, creator_id, creator_name,
        current_round_number, total_rounds, status, rounds_json, champion_user_id, champion_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 3, 'ACTIVE', ?, NULL, NULL, ?)
    `
      )
      .run(
        id,
        (params.title || 'Giải Đấu Tri Thức Liên Khối').trim(),
        (
          params.description ||
          'Vượt qua Vòng loại, Bán kết và chiến thắng Chung kết để nhận Huy hiệu Nhà vô địch Giải đấu.'
        ).trim(),
        cls ? cls.id : null,
        cls ? cls.name : 'Toàn trường',
        actor.id,
        actor.fullName,
        JSON.stringify(rounds),
        now
      );

    return this.listTournaments().find((t) => t.id === id)!;
  }

  public advanceTournamentRound(actor: UserProfile, tournamentId: string): TournamentRecord {
    if (actor.role === 'STUDENT') {
      throw new ApiValidationError('Chỉ Giáo viên hoặc Quản trị viên mới được chuyển vòng giải đấu.', 403);
    }

    const tour = this.listTournaments().find((t) => t.id === tournamentId);
    if (!tour) {
      throw new ApiValidationError('Không tìm thấy giải đấu.', 404);
    }
    if (tour.status === 'COMPLETED') {
      throw new ApiValidationError('Giải đấu này đã kết thúc và tìm ra Nhà vô địch.', 400);
    }

    const currentIdx = tour.currentRoundNumber - 1;
    const currentRound = tour.rounds[currentIdx];
    if (!currentRound) {
      throw new ApiValidationError('Vòng đấu hiện tại không hợp lệ.', 400);
    }

    currentRound.status = 'COMPLETED';
    currentRound.standings.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      return a.responseTimeMs - b.responseTimeMs;
    });

    currentRound.standings.forEach((entry, idx) => {
      entry.qualifiedForNext =
        idx < currentRound.qualifyTopCount && entry.score >= currentRound.minScoreToAdvance;
    });

    let newRoundNum = tour.currentRoundNumber;
    let newStatus: 'ACTIVE' | 'COMPLETED' = 'ACTIVE';
    let championUserId: string | null = tour.championUserId || null;
    let championName: string | null = tour.championName || null;

    if (tour.currentRoundNumber < tour.totalRounds) {
      newRoundNum = tour.currentRoundNumber + 1;
      const nextRound = tour.rounds[newRoundNum - 1];
      if (nextRound) {
        nextRound.status = 'OPEN';
      }
    } else {
      newStatus = 'COMPLETED';
      const topWinner = currentRound.standings[0];
      if (topWinner) {
        championUserId = topWinner.userId;
        championName = topWinner.fullName;
        this.awardXpIdempotent({
          userId: topWinner.userId,
          sourceType: 'TOURNAMENT_CHAMPION',
          sourceRefId: tour.id,
          xpDelta: 350,
          achievementDelta: 100,
          tournamentDelta: 250,
          reason: `Đăng quang Nhà vô địch Giải đấu "${tour.title}"`,
        });
        this.evaluateAndUnlockBadges(topWinner.userId, {
          isTournamentChampion: true,
        });
      }
    }

    this.db
      .prepare(
        `
      UPDATE tournaments
      SET current_round_number = ?, status = ?, rounds_json = ?,
          champion_user_id = ?, champion_name = ?
      WHERE id = ?
    `
      )
      .run(
        newRoundNum,
        newStatus,
        JSON.stringify(tour.rounds),
        championUserId,
        championName,
        tournamentId
      );

    return this.listTournaments().find((t) => t.id === tournamentId)!;
  }

  /**
   * Universal Server-Authoritative Session Starter for Modes 2, 4, 5, 6, 7, 8
   */
  public startInteractiveModeSession(
    user: UserProfile,
    params: {
      mode:
        | 'SOLO_COMPETITIVE'
        | 'FREE_PRACTICE'
        | 'SPEED_CHALLENGE'
        | 'DAILY_CHALLENGE'
        | 'CLASS_COMPETITION'
        | 'TOURNAMENT';
      questionSetId?: string;
      subject?: string;
      gradeLevel?: string;
      difficulty?: string;
      questionCount?: number;
      timeLimitSec?: number;
      referenceId?: string;
      roundNumber?: number;
    }
  ): SoloOrPracticeSessionPayload {
    const mode = params.mode;
    let targetSetId = params.questionSetId || '';
    let title = '';
    let totalTimeLimitSec: number | null = null;
    let perQuestionTimeSec = 20;
    let showExplanationImmediately = mode === 'FREE_PRACTICE';
    let questionLimit = Math.max(1, Math.min(30, Number(params.questionCount) || 5));
    let referenceId = params.referenceId || '';
    let roundNumber = params.roundNumber || 1;

    if (mode === 'DAILY_CHALLENGE') {
      const daily = this.getDailyChallengeInfo(user);
      if (daily.alreadyCompletedToday) {
        throw new ApiValidationError(
          'Bạn đã hoàn thành Thử thách hằng ngày hôm nay rồi. Hãy quay lại vào ngày mai để nối dài chuỗi Streak!',
          409
        );
      }
      targetSetId = daily.questionSetId;
      title = daily.title;
      questionLimit = daily.questionCount;
      totalTimeLimitSec = 180;
      referenceId = daily.challengeDate;
    } else if (mode === 'CLASS_COMPETITION') {
      if (!referenceId) {
        throw new ApiValidationError('Vui lòng chọn nhiệm vụ lớp học cần làm bài.', 400);
      }
      const assignment = this.listClassAssignments(user).find((a) => a.id === referenceId);
      if (!assignment) {
        throw new ApiValidationError('Không tìm thấy nhiệm vụ thi đấu của lớp.', 404);
      }
      if (assignment.status !== 'OPEN') {
        throw new ApiValidationError('Nhiệm vụ lớp học này hiện không trong thời gian mở nhận bài.', 400);
      }
      if (assignment.myAttemptsCount >= assignment.maxAttempts) {
        throw new ApiValidationError(
          `Bạn đã sử dụng hết ${assignment.maxAttempts} lượt làm bài cho nhiệm vụ này.`,
          403
        );
      }
      targetSetId = assignment.questionSetId;
      title = assignment.title;
      totalTimeLimitSec = assignment.timeLimitSec;
      showExplanationImmediately = assignment.modeType === 'PRACTICE';
      questionLimit = 10;
    } else if (mode === 'TOURNAMENT') {
      if (!referenceId) {
        throw new ApiValidationError('Vui lòng chọn giải đấu cần tham gia.', 400);
      }
      const tour = this.listTournaments().find((t) => t.id === referenceId);
      if (!tour) {
        throw new ApiValidationError('Không tìm thấy giải đấu.', 404);
      }
      if (tour.status !== 'ACTIVE') {
        throw new ApiValidationError('Giải đấu này đã kết thúc.', 400);
      }
      roundNumber = tour.currentRoundNumber;
      const activeRound = tour.rounds.find((r) => r.roundNumber === roundNumber);
      if (!activeRound || activeRound.status !== 'OPEN') {
        throw new ApiValidationError('Vòng đấu hiện tại chưa mở.', 400);
      }
      if (roundNumber > 1) {
        const prevRound = tour.rounds.find((r) => r.roundNumber === roundNumber - 1);
        const wasQualified = prevRound?.standings.some(
          (s) => s.userId === user.id && s.qualifiedForNext
        );
        // Allow entry if qualified OR if previous round had 0 participants (so teacher/demo can test any round smoothly)
        if (prevRound && prevRound.standings.length > 0 && !wasQualified) {
          throw new ApiValidationError(
            `Bạn chưa đủ điều kiện vượt qua ${prevRound.roundName} để thi đấu ${activeRound.roundName}.`,
            403
          );
        }
      }
      targetSetId = activeRound.questionSetId;
      title = `${tour.title} – ${activeRound.roundName}`;
      questionLimit = activeRound.questionCount;
      totalTimeLimitSec = activeRound.timeLimitSec;
    }

    const allSets = this.repo.listQuestionSets();
    let chosenSet = allSets.find((s) => s.id === targetSetId);
    if (!chosenSet && params.subject) {
      chosenSet = allSets.find(
        (s) => s.subject.toLowerCase() === params.subject!.trim().toLowerCase()
      );
    }
    if (!chosenSet) {
      chosenSet = allSets[0];
    }
    if (!chosenSet) {
      throw new ApiValidationError('Chưa có bộ câu hỏi nào trong ngân hàng.', 400);
    }

    let rawQuestions: FullQuestion[] = this.repo.getQuestionsForSet(chosenSet.id);
    if (params.difficulty && params.difficulty !== 'ALL') {
      const filtered = rawQuestions.filter((q) => q.difficulty === params.difficulty);
      if (filtered.length > 0) rawQuestions = filtered;
    }

    if (rawQuestions.length === 0) {
      throw new ApiValidationError('Bộ câu hỏi này chưa có câu hỏi nào.', 400);
    }

    const selectedQuestions = rawQuestions.slice(0, questionLimit);

    if (mode === 'FREE_PRACTICE') {
      totalTimeLimitSec =
        typeof params.timeLimitSec === 'number' && params.timeLimitSec > 0
          ? params.timeLimitSec
          : null;
      title = title || `Luyện tập tự do: ${chosenSet.title}`;
    } else if (mode === 'SPEED_CHALLENGE') {
      totalTimeLimitSec =
        typeof params.timeLimitSec === 'number' && params.timeLimitSec >= 30
          ? params.timeLimitSec
          : 90;
      perQuestionTimeSec = 12;
      title = title || `Thử thách tốc độ (${totalTimeLimitSec}s): ${chosenSet.title}`;
    } else if (mode === 'SOLO_COMPETITIVE') {
      totalTimeLimitSec =
        typeof params.timeLimitSec === 'number' && params.timeLimitSec >= 30
          ? params.timeLimitSec
          : selectedQuestions.length * 20;
      title = title || `Thi đấu cá nhân: ${chosenSet.title}`;
    }

    const sessionId = `solosess_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
      INSERT INTO solo_game_sessions (
        id, user_id, mode, title, question_set_id, question_set_title,
        subject, grade_level, reference_id, round_number, total_time_limit_sec,
        per_question_time_sec, show_explanation_immediately, questions_json,
        status, started_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
    `
      )
      .run(
        sessionId,
        user.id,
        mode,
        title,
        chosenSet.id,
        chosenSet.title,
        chosenSet.subject || 'Tổng hợp',
        chosenSet.gradeLevel || 'THPT',
        referenceId,
        roundNumber,
        totalTimeLimitSec,
        perQuestionTimeSec,
        showExplanationImmediately ? 1 : 0,
        JSON.stringify(selectedQuestions),
        now
      );

    // Strip answers unless FREE_PRACTICE immediate explanation is requested via check endpoint
    const publicQuestions: PublicQuestion[] = selectedQuestions.map((q, idx) => ({
      id: q.id,
      questionSetId: q.questionSetId,
      orderIndex: idx,
      questionType: q.questionType || 'SINGLE_CHOICE',
      prompt: q.prompt,
      imageUrl: q.imageUrl,
      audioUrl: q.audioUrl,
      videoUrl: q.videoUrl,
      options: q.options,
      timeLimitSec: q.timeLimitSec || perQuestionTimeSec,
      points: q.points || 100,
    }));

    return {
      sessionId,
      mode,
      title,
      questionSetId: chosenSet.id,
      questionSetTitle: chosenSet.title,
      totalTimeLimitSec,
      perQuestionTimeLimitSec: perQuestionTimeSec,
      showExplanationImmediately,
      questions: publicQuestions,
      referenceId,
      roundNumber,
    };
  }

  /**
   * Immediate single-question check for Mode 4: FREE_PRACTICE
   */
  public checkPracticeAnswerImmediate(
    user: UserProfile,
    sessionId: string,
    questionId: string,
    selectedIndex: number
  ): {
    questionId: string;
    isCorrect: boolean;
    correctIndex: number;
    explanation: string;
  } {
    const row = this.db
      .prepare('SELECT * FROM solo_game_sessions WHERE id = ? AND user_id = ?')
      .get(sessionId, user.id) as any;
    if (!row) {
      throw new ApiValidationError('Không tìm thấy phiên luyện tập.', 404);
    }
    const questions: FullQuestion[] = JSON.parse(row.questions_json || '[]');
    const q = questions.find((item) => item.id === questionId);
    if (!q) {
      throw new ApiValidationError('Không tìm thấy câu hỏi trong phiên này.', 404);
    }

    return {
      questionId: q.id,
      isCorrect: selectedIndex === q.correctIndex,
      correctIndex: q.correctIndex,
      explanation: q.explanation || 'Đáp án đúng đã được xác nhận bởi ngân hàng câu hỏi.',
    };
  }

  /**
   * Server-Authoritative Session Completion & Grading for Modes 2, 4, 5, 6, 7, 8
   */
  public submitInteractiveModeSession(
    user: UserProfile,
    sessionId: string,
    answers: Array<{
      questionId: string;
      selectedIndex: number | null;
      selectedIndices?: number[];
      responseTimeMs: number;
    }>
  ): SoloOrPracticeResultSummary {
    const row = this.db
      .prepare('SELECT * FROM solo_game_sessions WHERE id = ? AND user_id = ?')
      .get(sessionId, user.id) as any;

    if (!row) {
      throw new ApiValidationError('Không tìm thấy phiên chơi tương ứng.', 404);
    }
    if (row.status === 'COMPLETED') {
      throw new ApiValidationError('Phiên chơi này đã được nộp và chấm điểm trước đó.', 409);
    }

    const questions: FullQuestion[] = JSON.parse(row.questions_json || '[]');
    const answerMap = new Map(answers.map((a) => [a.questionId, a]));

    let totalScore = 0;
    let correctCount = 0;
    let currentStreak = 0;
    let maxStreak = 0;
    let totalResponseTimeMs = 0;
    const questionReviews: SoloOrPracticeResultSummary['questionReviews'] = [];

    const scoringGameMode: 'SPEED_PRECISION' | 'STANDARD' =
      row.mode === 'FREE_PRACTICE' ? 'STANDARD' : 'SPEED_PRECISION';

    for (const q of questions) {
      const sub = answerMap.get(q.id);
      const selectedIdx =
        sub && typeof sub.selectedIndex === 'number' ? sub.selectedIndex : null;
      const respMs = Math.max(
        200,
        Math.min((q.timeLimitSec || 20) * 1000, Number(sub?.responseTimeMs) || 5000)
      );
      totalResponseTimeMs += respMs;

      if (selectedIdx === null) {
        currentStreak = 0;
        questionReviews.push({
          questionId: q.id,
          prompt: q.prompt,
          options: q.options,
          selectedIndex: null,
          correctIndex: q.correctIndex,
          isCorrect: false,
          earnedPoints: 0,
          explanation: q.explanation,
        });
        continue;
      }

      const nowMs = Date.now();
      const scoreCalc = ServerScoringEngine.calculateAnswerScore({
        gameMode: scoringGameMode,
        questionType: q.questionType || 'SINGLE_CHOICE',
        basePoints: q.points || 100,
        timeLimitSec: q.timeLimitSec || 20,
        questionStartedAtMs: nowMs - respMs,
        answeredAtMs: nowMs,
        selectedOptionIndex: selectedIdx,
        selectedOptionIndices: sub?.selectedIndices || [selectedIdx],
        correctOptionIndex: q.correctIndex,
        correctOptionIndices: q.correctIndices,
        currentStreak,
      });

      if (scoreCalc.isCorrect) {
        correctCount += 1;
        currentStreak += 1;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
      } else {
        currentStreak = 0;
      }

      totalScore += scoreCalc.totalEarnedPoints;
      questionReviews.push({
        questionId: q.id,
        prompt: q.prompt,
        options: q.options,
        selectedIndex: selectedIdx,
        correctIndex: q.correctIndex,
        isCorrect: scoreCalc.isCorrect,
        earnedPoints: scoreCalc.totalEarnedPoints,
        explanation: q.explanation,
      });
    }

    const totalQuestions = questions.length;
    const accuracyPercent =
      totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const nowIso = new Date().toISOString();

    // Calculate XP & Achievement rewards strictly on backend
    let xpEarned = correctCount * 15 + (accuracyPercent === 100 ? 40 : 15);
    let achievementPointsEarned = correctCount * 5;
    let tournamentPointsEarned = 0;

    this.ensureXpProfileRow(user.id);

    if (row.mode === 'FREE_PRACTICE') {
      this.db
        .prepare(
          'UPDATE user_xp_profiles SET practice_count = practice_count + 1, updated_at = ? WHERE user_id = ?'
        )
        .run(nowIso, user.id);
    } else if (row.mode === 'SPEED_CHALLENGE') {
      this.db
        .prepare(
          'UPDATE user_xp_profiles SET speed_best_score = MAX(speed_best_score, ?), updated_at = ? WHERE user_id = ?'
        )
        .run(totalScore, nowIso, user.id);
    } else if (row.mode === 'DAILY_CHALLENGE') {
      const todayStr = row.reference_id || nowIso.slice(0, 10);
      const insertDaily = this.db
        .prepare(
          `
        INSERT OR IGNORE INTO daily_challenge_completions (
          id, user_id, full_name, challenge_date, score, correct_count, total_questions, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          `dc_${crypto.randomBytes(6).toString('hex')}`,
          user.id,
          user.fullName,
          todayStr,
          totalScore,
          correctCount,
          totalQuestions,
          nowIso
        );

      if (insertDaily.changes === 0) {
        throw new ApiValidationError(
          'Bạn đã nhận thưởng Thử thách hằng ngày hôm nay rồi.',
          409
        );
      }

      const profile = this.db
        .prepare('SELECT daily_streak, last_daily_date FROM user_xp_profiles WHERE user_id = ?')
        .get(user.id) as { daily_streak: number; last_daily_date: string };

      const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
      const newStreak =
        profile.last_daily_date === yesterday ? (profile.daily_streak || 0) + 1 : 1;

      this.db
        .prepare(
          'UPDATE user_xp_profiles SET daily_streak = ?, last_daily_date = ?, updated_at = ? WHERE user_id = ?'
        )
        .run(newStreak, todayStr, nowIso, user.id);

      xpEarned += 150;
      achievementPointsEarned += 40;
    } else if (row.mode === 'CLASS_COMPETITION' && row.reference_id) {
      const existingSub = this.db
        .prepare(
          'SELECT * FROM class_assignment_submissions WHERE assignment_id = ? AND student_id = ?'
        )
        .get(row.reference_id, user.id) as any;

      if (!existingSub) {
        this.db
          .prepare(
            `
          INSERT INTO class_assignment_submissions (
            id, assignment_id, student_id, student_name, attempt_count,
            best_score, correct_count, total_questions, total_time_ms, status, submitted_at
          ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, 'COMPLETED', ?)
        `
          )
          .run(
            `cas_${crypto.randomBytes(6).toString('hex')}`,
            row.reference_id,
            user.id,
            user.fullName,
            totalScore,
            correctCount,
            totalQuestions,
            totalResponseTimeMs,
            nowIso
          );
      } else {
        this.db
          .prepare(
            `
          UPDATE class_assignment_submissions
          SET attempt_count = attempt_count + 1,
              best_score = MAX(best_score, ?),
              correct_count = MAX(correct_count, ?),
              total_time_ms = MIN(total_time_ms, ?),
              submitted_at = ?
          WHERE assignment_id = ? AND student_id = ?
        `
          )
          .run(
            totalScore,
            correctCount,
            totalResponseTimeMs,
            nowIso,
            row.reference_id,
            user.id
          );
      }
      xpEarned += 50;
      achievementPointsEarned += 25;
    } else if (row.mode === 'TOURNAMENT' && row.reference_id) {
      const tour = this.listTournaments().find((t) => t.id === row.reference_id);
      if (tour) {
        const roundObj = tour.rounds.find((r) => r.roundNumber === row.round_number);
        if (roundObj) {
          const existingIdx = roundObj.standings.findIndex((s) => s.userId === user.id);
          const entry = {
            userId: user.id,
            fullName: user.fullName,
            schoolName: user.schoolName || 'THPT Quizzi',
            score: totalScore,
            correctCount,
            responseTimeMs: totalResponseTimeMs,
            qualifiedForNext: totalScore >= roundObj.minScoreToAdvance,
            completedAt: nowIso,
          };
          if (existingIdx >= 0) {
            if (totalScore >= roundObj.standings[existingIdx].score) {
              roundObj.standings[existingIdx] = entry;
            }
          } else {
            roundObj.standings.push(entry);
          }
          roundObj.standings.sort((a, b) => b.score - a.score);
          roundObj.standings.forEach((s, idx) => {
            s.qualifiedForNext =
              idx < roundObj.qualifyTopCount && s.score >= roundObj.minScoreToAdvance;
          });

          this.db
            .prepare('UPDATE tournaments SET rounds_json = ? WHERE id = ?')
            .run(JSON.stringify(tour.rounds), tour.id);
        }
      }
      tournamentPointsEarned = Math.round(totalScore / 4) + correctCount * 15;
      xpEarned += 80;
    }

    this.db
      .prepare(
        `
      UPDATE solo_game_sessions
      SET status = 'COMPLETED',
          total_score = ?,
          correct_count = ?,
          total_questions = ?,
          max_streak = ?,
          total_response_time_ms = ?,
          xp_earned = ?,
          completed_at = ?
      WHERE id = ?
    `
      )
      .run(
        totalScore,
        correctCount,
        totalQuestions,
        maxStreak,
        totalResponseTimeMs,
        xpEarned,
        nowIso,
        sessionId
      );

    // Also record competitive solo/speed/class/tournament into match history so global match scores stay unified
    if (row.mode !== 'FREE_PRACTICE') {
      this.repo.saveCompletedMatch({
        roomId: `solo_${sessionId}`,
        sessionId,
        roomCode: row.mode.slice(0, 6),
        roomTitle: row.title,
        questionSetId: row.question_set_id,
        questionSetTitle: row.question_set_title,
        hostId: user.id,
        hostName: user.fullName,
        totalQuestions,
        participants: [
          {
            userId: user.id,
            displayName: user.fullName,
            role: user.role,
            score: totalScore,
            correctCount,
            maxStreak,
          },
        ],
        submissions: questionReviews.map((qr, idx) => ({
          userId: user.id,
          questionId: qr.questionId,
          questionIndex: idx,
          prompt: qr.prompt,
          options: qr.options,
          selectedIndex: qr.selectedIndex,
          correctIndex: qr.correctIndex,
          isCorrect: qr.isCorrect,
          earnedPoints: qr.earnedPoints,
          responseTimeMs: Math.round(totalResponseTimeMs / Math.max(1, totalQuestions)),
          explanation: qr.explanation,
        })),
      });
    }

    const awardRes = this.awardXpIdempotent({
      userId: user.id,
      sourceType: row.mode,
      sourceRefId: row.mode === 'DAILY_CHALLENGE' ? row.reference_id || sessionId : sessionId,
      xpDelta: xpEarned,
      achievementDelta: achievementPointsEarned,
      tournamentDelta: tournamentPointsEarned,
      reason: `Hoàn thành ${row.title} (${correctCount}/${totalQuestions} câu đúng)`,
    });

    // Check if student is #1 in Class Assignment
    let isFirstInClass = false;
    if (row.mode === 'CLASS_COMPETITION' && row.reference_id) {
      const standings = this.getClassAssignmentStandings(row.reference_id);
      if (standings.length > 0 && standings[0].studentId === user.id) {
        isFirstInClass = true;
      }
    }

    const newlyUnlockedBadges = this.evaluateAndUnlockBadges(user.id, {
      isFirstPlaceInRoomOrClass: isFirstInClass,
      sessionAccuracyPercent: accuracyPercent,
      sessionTotalQuestions: totalQuestions,
      sessionMaxStreak: maxStreak,
      speedChallengeScore: row.mode === 'SPEED_CHALLENGE' ? totalScore : undefined,
    });

    return {
      sessionId,
      mode: row.mode,
      totalScore,
      correctCount,
      totalQuestions,
      accuracyPercent,
      maxStreak,
      totalResponseTimeMs,
      xpEarned,
      achievementPointsEarned,
      tournamentPointsEarned,
      leveledUp: awardRes.leveledUp,
      newLevel: awardRes.newLevel,
      newlyUnlockedBadges,
      questionReviews,
    };
  }

  /**
   * Section XIII: Multi-Dimensional Leaderboards
   * Strictly separates Match Score, XP, Achievement Points, and Tournament Points!
   */
  public getMultiDimensionalLeaderboard(params: {
    boardType?:
      | 'OVERALL'
      | 'MATCH'
      | 'CLASS'
      | 'SUBJECT'
      | 'WEEKLY'
      | 'MONTHLY'
      | 'SEASON';
    metric?: 'MATCH_SCORE' | 'XP' | 'ACHIEVEMENT_POINTS' | 'TOURNAMENT_POINTS';
    classroomId?: string;
    subject?: string;
    gradeLevel?: string;
    anonymizeStudents?: boolean;
    viewerUserId?: string;
  }): {
    boardType: string;
    metric: string;
    metricLabel: string;
    entries: MultiDimensionalLeaderboardRow[];
  } {
    const boardType = params.boardType || 'OVERALL';
    const metric = params.metric || 'MATCH_SCORE';

    let sinceIso: string | null = null;
    const now = Date.now();
    if (boardType === 'WEEKLY') {
      sinceIso = new Date(now - 7 * 24 * 3600 * 1000).toISOString();
    } else if (boardType === 'MONTHLY') {
      sinceIso = new Date(now - 30 * 24 * 3600 * 1000).toISOString();
    } else if (boardType === 'SEASON') {
      sinceIso = new Date(now - 90 * 24 * 3600 * 1000).toISOString();
    }

    const users = this.db
      .prepare('SELECT id, full_name, role, school_name, class_name FROM users WHERE is_locked = 0')
      .all() as Array<{
      id: string;
      full_name: string;
      role: string;
      school_name: string;
      class_name: string;
    }>;

    let allowedUserIds: Set<string> | null = null;
    if (params.classroomId) {
      const members = this.repo.listClassroomMembers(params.classroomId);
      allowedUserIds = new Set(members.map((m) => m.studentId));
    }

    const rows: MultiDimensionalLeaderboardRow[] = [];

    for (const u of users) {
      if (allowedUserIds && !allowedUserIds.has(u.id)) continue;
      if (
        params.gradeLevel &&
        params.gradeLevel.trim() &&
        !u.class_name.toLowerCase().includes(params.gradeLevel.trim().toLowerCase())
      ) {
        continue;
      }

      this.ensureXpProfileRow(u.id);
      const xpProf = this.db
        .prepare('SELECT * FROM user_xp_profiles WHERE user_id = ?')
        .get(u.id) as any;

      let matchSql = `
        SELECT COUNT(*) as matchesPlayed,
               COALESCE(SUM(mp.score), 0) as matchScore,
               COALESCE(SUM(mp.correct_count), 0) as totalCorrect,
               COALESCE(SUM(mh.total_questions), 0) as totalQuestions
        FROM match_participants mp
        JOIN match_history mh ON mh.id = mp.match_id
        LEFT JOIN question_sets qs ON qs.id = mh.question_set_id
        WHERE mp.user_id = ?
      `;
      const sqlArgs: any[] = [u.id];

      if (sinceIso) {
        matchSql += ' AND mh.completed_at >= ?';
        sqlArgs.push(sinceIso);
      }
      if (params.subject && params.subject.trim()) {
        matchSql += ' AND LOWER(COALESCE(qs.subject, "")) LIKE ?';
        sqlArgs.push(`%${params.subject.trim().toLowerCase()}%`);
      }

      const mStats = this.db.prepare(matchSql).get(...sqlArgs) as {
        matchesPlayed: number;
        matchScore: number;
        totalCorrect: number;
        totalQuestions: number;
      };

      const badgeCount = (
        this.db
          .prepare('SELECT COUNT(*) as c FROM user_badges WHERE user_id = ?')
          .get(u.id) as { c: number }
      ).c;

      const meta = this.getLevelMetadata(xpProf?.total_xp || 0);
      const matchScore = mStats?.matchScore || 0;
      const totalXp = xpProf?.total_xp || 0;
      const achievementPoints = xpProf?.achievement_points || 0;
      const tournamentPoints = xpProf?.tournament_points || 0;

      let primaryMetricValue = matchScore;
      let primaryMetricLabel = 'Điểm trận đấu';
      if (metric === 'XP') {
        primaryMetricValue = totalXp;
        primaryMetricLabel = 'Điểm kinh nghiệm (XP)';
      } else if (metric === 'ACHIEVEMENT_POINTS') {
        primaryMetricValue = achievementPoints;
        primaryMetricLabel = 'Điểm thành tích';
      } else if (metric === 'TOURNAMENT_POINTS') {
        primaryMetricValue = tournamentPoints;
        primaryMetricLabel = 'Điểm giải đấu';
      }

      const isSelf = params.viewerUserId === u.id;
      const maskedName =
        params.anonymizeStudents && !isSelf && u.role === 'STUDENT'
          ? `Học sinh #${u.id.slice(-4).toUpperCase()}`
          : u.full_name;

      const accuracyPercent =
        (mStats?.totalQuestions || 0) > 0
          ? Math.round(((mStats?.totalCorrect || 0) / mStats.totalQuestions) * 100)
          : 0;

      rows.push({
        rank: 0,
        userId: u.id,
        fullName: u.full_name,
        displayName: maskedName,
        role: u.role,
        schoolName: u.school_name || 'THPT Quizzi',
        className: u.class_name || '12A1',
        matchScore,
        totalXp,
        level: meta.level,
        levelTitle: meta.levelTitle,
        achievementPoints,
        tournamentPoints,
        matchesPlayed: mStats?.matchesPlayed || 0,
        totalCorrect: mStats?.totalCorrect || 0,
        accuracyPercent,
        badgeCount,
        primaryMetricValue,
        primaryMetricLabel,
      });
    }

    rows.sort((a, b) => {
      if (b.primaryMetricValue !== a.primaryMetricValue) {
        return b.primaryMetricValue - a.primaryMetricValue;
      }
      if (b.totalCorrect !== a.totalCorrect) return b.totalCorrect - a.totalCorrect;
      return a.fullName.localeCompare(b.fullName, 'vi');
    });

    rows.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    const metricLabel =
      metric === 'XP'
        ? 'Điểm kinh nghiệm (XP)'
        : metric === 'ACHIEVEMENT_POINTS'
          ? 'Điểm thành tích'
          : metric === 'TOURNAMENT_POINTS'
            ? 'Điểm giải đấu'
            : 'Điểm trận đấu';

    return {
      boardType,
      metric,
      metricLabel,
      entries: rows,
    };
  }
}
