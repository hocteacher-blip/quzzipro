import React, { useEffect, useRef, useState } from 'react';
import {
  Award,
  BookOpen,
  BookOpenCheck,
  Bookmark,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  Crown,
  Flame,
  Gamepad2,
  GraduationCap,
  Play,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  Timer,
  Trophy,
  UserCheck,
  Users,
  Volume2,
  VolumeX,
  XCircle,
  Zap,
} from 'lucide-react';
import { apiClient } from '../services/apiClient.ts';
import { soundManager, type AudioVisualSettings } from '../services/soundEffects.ts';
import type {
  BadgeDefinitionRecord,
  BookmarkedQuestionRecord,
  ClassAssignmentRecord,
  ClassAssignmentSubmissionRecord,
  Classroom,
  DailyChallengeInfo,
  GameModeCardInfo,
  LearningMissionRecord,
  LiveRoomState,
  PlayModeCategory,
  QuestionSet,
  SoloOrPracticeResultSummary,
  SoloOrPracticeSessionPayload,
  TournamentRecord,
  UserProfile,
  XpProfileSummary,
} from '../types/arena.ts';

interface GameCenterViewProps {
  currentUser: UserProfile;
  questionSets: QuestionSet[];
  classrooms: Classroom[];
  onRoomEntered: (room: LiveRoomState) => void;
  onRefreshGlobalData: () => void;
}

export const GameCenterView: React.FC<GameCenterViewProps> = ({
  currentUser,
  questionSets,
  classrooms,
  onRoomEntered,
  onRefreshGlobalData,
}) => {
  const [subTab, setSubTab] = useState<
    | 'MODES_HUB'
    | 'CLASS_COMPETITION'
    | 'DAILY_CHALLENGE'
    | 'TOURNAMENTS'
    | 'XP_BADGES_MISSIONS'
    | 'BOOKMARKS'
  >('MODES_HUB');

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const [modes, setModes] = useState<GameModeCardInfo[]>([]);
  const [xpProfile, setXpProfile] = useState<XpProfileSummary | null>(null);
  const [badges, setBadges] = useState<BadgeDefinitionRecord[]>([]);
  const [missions, setMissions] = useState<LearningMissionRecord[]>([]);
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallengeInfo | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkedQuestionRecord[]>([]);
  const [classAssignments, setClassAssignments] = useState<ClassAssignmentRecord[]>([]);
  const [tournaments, setTournaments] = useState<TournamentRecord[]>([]);

  // Audio & Visual Accessibility Settings (Section XV)
  const [avSettings, setAvSettings] = useState<AudioVisualSettings>(() =>
    soundManager.getSettings()
  );
  const [showAvPanel, setShowAvPanel] = useState(false);

  // Configuration Modal for Launching Modes 1, 2, 3, 4, 5
  const [configuringMode, setConfiguringMode] = useState<PlayModeCategory | null>(null);
  const [cfgSetId, setCfgSetId] = useState<string>(questionSets[0]?.id || '');
  const [cfgSubject, setCfgSubject] = useState<string>('');
  const [cfgDifficulty, setCfgDifficulty] = useState<string>('ALL');
  const [cfgQuestionCount, setCfgQuestionCount] = useState<number>(5);
  const [cfgTimeLimitSec, setCfgTimeLimitSec] = useState<number>(90);
  const [cfgUnlimitedTime, setCfgUnlimitedTime] = useState<boolean>(false);

  // Live / Team Room creation fields (Section V & XVI)
  const [cfgRoomTitle, setCfgRoomTitle] = useState<string>('');
  const [cfgClassroomId, setCfgClassroomId] = useState<string>('');
  const [cfgMaxParticipants, setCfgMaxParticipants] = useState<number>(50);
  const [cfgTeamCount, setCfgTeamCount] = useState<number>(2);
  const [cfgTeamFormat, setCfgTeamFormat] = useState<
    'ALL_MEMBERS_SCORE' | 'CAPTAIN_REPRESENTATIVE' | 'TURN_BY_TURN' | 'TEAM_CONSENSUS'
  >('ALL_MEMBERS_SCORE');
  const [cfgRevealPolicy, setCfgRevealPolicy] = useState<'IMMEDIATE' | 'END_OF_MATCH'>(
    'IMMEDIATE'
  );
  const [cfgAllowRejoin, setCfgAllowRejoin] = useState<boolean>(true);
  const [cfgJoinPin, setCfgJoinPin] = useState<string>('');

  // Interactive Session Runner State (for Modes 2, 4, 5, 6, 7, 8)
  const [activeSession, setActiveSession] = useState<SoloOrPracticeSessionPayload | null>(
    null
  );
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [practiceImmediateCheck, setPracticeImmediateCheck] = useState<{
    isCorrect: boolean;
    correctIndex: number;
    explanation: string;
  } | null>(null);
  const [collectedAnswers, setCollectedAnswers] = useState<
    Array<{
      questionId: string;
      selectedIndex: number | null;
      responseTimeMs: number;
    }>
  >([]);
  const [comboStreak, setComboStreak] = useState<number>(0);
  const [remainingSessionSec, setRemainingSessionSec] = useState<number | null>(null);
  const [questionStartTimeMs, setQuestionStartTimeMs] = useState<number>(Date.now());
  const [sessionResult, setSessionResult] = useState<SoloOrPracticeResultSummary | null>(
    null
  );
  const [submittingSession, setSubmittingSession] = useState<boolean>(false);
  const [bookmarkNoteInput, setBookmarkNoteInput] = useState<string>('');

  // Class Competition creation & standings state
  const [newAssignTitle, setNewAssignTitle] = useState<string>('');
  const [newAssignClassId, setNewAssignClassId] = useState<string>(
    classrooms[0]?.id || ''
  );
  const [newAssignSetId, setNewAssignSetId] = useState<string>(questionSets[0]?.id || '');
  const [newAssignMode, setNewAssignMode] = useState<'PRACTICE' | 'TIMED_COMPETITION'>(
    'TIMED_COMPETITION'
  );
  const [newAssignMaxAttempts, setNewAssignMaxAttempts] = useState<number>(2);
  const [newAssignTimeSec, setNewAssignTimeSec] = useState<number>(300);
  const [selectedAssignmentStandings, setSelectedAssignmentStandings] = useState<{
    assignmentId: string;
    title: string;
    rows: ClassAssignmentSubmissionRecord[];
  } | null>(null);

  // Tournament creation state
  const [newTourTitle, setNewTourTitle] = useState<string>('');
  const [newTourDesc, setNewTourDesc] = useState<string>('');
  const [newTourRound1Set, setNewTourRound1Set] = useState<string>(
    questionSets[0]?.id || ''
  );
  const [newTourRound2Set, setNewTourRound2Set] = useState<string>(
    questionSets[1]?.id || questionSets[0]?.id || ''
  );
  const [newTourRound3Set, setNewTourRound3Set] = useState<string>(
    questionSets[2]?.id || questionSets[0]?.id || ''
  );

  // Admin Badge Editor state
  const [editingBadgeCode, setEditingBadgeCode] = useState<string | null>(null);
  const [editBadgeName, setEditBadgeName] = useState<string>('');
  const [editBadgeDesc, setEditBadgeDesc] = useState<string>('');
  const [editBadgeCondVal, setEditBadgeCondVal] = useState<number>(1);
  const [editBadgeXp, setEditBadgeXp] = useState<number>(50);

  const answersRef = useRef(collectedAnswers);
  answersRef.current = collectedAnswers;

  const loadHubData = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getGameCenterHub();
      setModes(data.modes);
      setXpProfile(data.xpProfile);
      setBadges(data.badges);
      setMissions(data.missions);
      setDailyChallenge(data.dailyChallenge);
      setBookmarks(data.bookmarks);
      setClassAssignments(data.classAssignments);
      setTournaments(data.tournaments);
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err?.message || 'Không thể tải dữ liệu Trung tâm Trò chơi.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHubData();
  }, []);

  // Countdown timer for active interactive session
  useEffect(() => {
    if (!activeSession || sessionResult || remainingSessionSec === null) return;
    if (remainingSessionSec <= 0) {
      handleFinalizeInteractiveSession(answersRef.current);
      return;
    }

    const timer = setInterval(() => {
      setRemainingSessionSec((prev) => {
        if (prev === null) return null;
        const next = prev - 1;
        if (next <= 5 && next > 0) {
          soundManager.playCountdownTick(true);
        }
        return Math.max(0, next);
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeSession, sessionResult, remainingSessionSec]);

  const handleUpdateAvSettings = (partial: Partial<AudioVisualSettings>) => {
    const updated = soundManager.updateSettings(partial);
    setAvSettings(updated);
  };

  const openModeLauncher = (modeId: PlayModeCategory) => {
    setBanner(null);
    if (modeId === 'CLASS_COMPETITION') {
      setSubTab('CLASS_COMPETITION');
      return;
    }
    if (modeId === 'DAILY_CHALLENGE') {
      setSubTab('DAILY_CHALLENGE');
      return;
    }
    if (modeId === 'TOURNAMENT') {
      setSubTab('TOURNAMENTS');
      return;
    }
    setCfgSetId(questionSets[0]?.id || '');
    setCfgRoomTitle(
      modeId === 'TEAM_ARENA'
        ? `Đấu trường Đội nhóm - ${currentUser.fullName}`
        : `Đấu trường Trực tiếp - ${currentUser.fullName}`
    );
    setCfgUnlimitedTime(modeId === 'FREE_PRACTICE');
    setCfgTimeLimitSec(modeId === 'SPEED_CHALLENGE' ? 90 : 120);
    setConfiguringMode(modeId);
  };

  const handleLaunchConfiguredMode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configuringMode) return;
    setBanner(null);

    try {
      if (configuringMode === 'LIVE_ARENA' || configuringMode === 'TEAM_ARENA') {
        if (cfgJoinPin.trim()) {
          const { room } = await apiClient.joinRoom(cfgJoinPin.trim());
          soundManager.playMatchStart();
          onRoomEntered(room);
          return;
        }
        const isStudentTest = currentUser.role === 'STUDENT';
        const { room } = await apiClient.createRoom({
          questionSetId: cfgSetId || questionSets[0]?.id,
          title: cfgRoomTitle.trim() || 'Phòng Đấu Trường Quizzi',
          classroomId: cfgClassroomId || null,
          questionLimit: cfgQuestionCount,
          maxParticipants: cfgMaxParticipants,
          isTeamMode: configuringMode === 'TEAM_ARENA',
          teamCount: cfgTeamCount,
          teamPlayFormat: cfgTeamFormat,
          revealAnswersPolicy: cfgRevealPolicy,
          allowRejoinPolicy: cfgAllowRejoin,
          isTestMode: isStudentTest,
        });
        soundManager.playMatchStart();
        onRoomEntered(room);
        return;
      }

      // Interactive modes: SOLO_COMPETITIVE, FREE_PRACTICE, SPEED_CHALLENGE
      const { session } = await apiClient.startInteractiveSession({
        mode: configuringMode as 'SOLO_COMPETITIVE' | 'FREE_PRACTICE' | 'SPEED_CHALLENGE',
        questionSetId: cfgSetId,
        subject: cfgSubject || undefined,
        difficulty: cfgDifficulty,
        questionCount: cfgQuestionCount,
        timeLimitSec:
          configuringMode === 'FREE_PRACTICE' && cfgUnlimitedTime
            ? 0
            : cfgTimeLimitSec,
      });

      startInteractiveSessionRunner(session);
      setConfiguringMode(null);
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err?.message || 'Không thể khởi tạo chế độ chơi.',
      });
    }
  };

  const startInteractiveSessionRunner = (session: SoloOrPracticeSessionPayload) => {
    soundManager.playMatchStart();
    setActiveSession(session);
    setCurrentIdx(0);
    setSelectedIdx(null);
    setPracticeImmediateCheck(null);
    setCollectedAnswers([]);
    setComboStreak(0);
    setSessionResult(null);
    setRemainingSessionSec(session.totalTimeLimitSec);
    setQuestionStartTimeMs(Date.now());
  };

  const handleSelectOptionInSession = async (optIdx: number) => {
    if (!activeSession || sessionResult || submittingSession) return;
    const currentQ = activeSession.questions[currentIdx];
    if (!currentQ) return;

    setSelectedIdx(optIdx);

    if (activeSession.showExplanationImmediately) {
      try {
        const check = await apiClient.checkPracticeAnswerImmediate(
          activeSession.sessionId,
          currentQ.id,
          optIdx
        );
        setPracticeImmediateCheck(check);
        if (check.isCorrect) {
          soundManager.playCorrectAnswer();
          setComboStreak((s) => s + 1);
        } else {
          soundManager.playWrongAnswer();
          setComboStreak(0);
        }
      } catch {
        // ignore check error
      }
    }
  };

  const handleConfirmAndNextInSession = async () => {
    if (!activeSession || sessionResult || submittingSession) return;
    const currentQ = activeSession.questions[currentIdx];
    if (!currentQ) return;

    const elapsedMs = Math.max(250, Date.now() - questionStartTimeMs);
    const updatedAnswers = [
      ...collectedAnswers.filter((a) => a.questionId !== currentQ.id),
      {
        questionId: currentQ.id,
        selectedIndex: selectedIdx,
        responseTimeMs: elapsedMs,
      },
    ];
    setCollectedAnswers(updatedAnswers);

    if (!activeSession.showExplanationImmediately) {
      soundManager.playCountdownTick(false);
    }

    if (currentIdx + 1 < activeSession.questions.length) {
      setCurrentIdx(currentIdx + 1);
      setSelectedIdx(null);
      setPracticeImmediateCheck(null);
      setQuestionStartTimeMs(Date.now());
    } else {
      await handleFinalizeInteractiveSession(updatedAnswers);
    }
  };

  const handleRetryCurrentPracticeQuestion = () => {
    setSelectedIdx(null);
    setPracticeImmediateCheck(null);
    setQuestionStartTimeMs(Date.now());
  };

  const handleFinalizeInteractiveSession = async (
    finalAnswers: Array<{
      questionId: string;
      selectedIndex: number | null;
      responseTimeMs: number;
    }>
  ) => {
    if (!activeSession || submittingSession) return;
    try {
      setSubmittingSession(true);
      const { result } = await apiClient.submitInteractiveSession(
        activeSession.sessionId,
        finalAnswers
      );
      setSessionResult(result);
      if (result.leveledUp) {
        soundManager.playLevelUp();
      } else if (result.newlyUnlockedBadges.length > 0) {
        soundManager.playBadgeUnlocked();
      } else {
        soundManager.playVictoryFanfare();
      }
      await loadHubData();
      onRefreshGlobalData();
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err?.message || 'Lỗi khi chấm điểm phiên chơi trên máy chủ.',
      });
    } finally {
      setSubmittingSession(false);
    }
  };

  const handleToggleBookmark = async (questionId: string, note?: string) => {
    try {
      const res = await apiClient.toggleBookmarkQuestion(questionId, note);
      setBookmarks(res.bookmarks);
      setBanner({
        type: 'success',
        text: res.bookmarked
          ? 'Đã lưu câu hỏi khó vào sổ tay ôn tập cá nhân.'
          : 'Đã bỏ đánh dấu câu hỏi khỏi sổ tay.',
      });
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err?.message || 'Không thể đánh dấu câu hỏi.',
      });
    }
  };

  const handleClaimMission = async (code: string) => {
    try {
      const res = await apiClient.claimMissionReward(code);
      setXpProfile(res.xpProfile);
      setMissions((prev) =>
        prev.map((m) => (m.code === code ? { ...m, isClaimed: true } : m))
      );
      soundManager.playLevelUp();
      setBanner({
        type: 'success',
        text: `Nhận thưởng nhiệm vụ "${res.mission.title}" thành công (+${res.mission.xpReward} XP)!`,
      });
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err?.message || 'Không thể nhận thưởng nhiệm vụ.',
      });
    }
  };

  const handleCreateClassAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.createClassAssignment({
        title: newAssignTitle,
        classroomId: newAssignClassId,
        questionSetId: newAssignSetId,
        modeType: newAssignMode,
        maxAttempts: newAssignMaxAttempts,
        timeLimitSec: newAssignTimeSec,
      });
      setNewAssignTitle('');
      await loadHubData();
      setBanner({
        type: 'success',
        text: 'Đã giao nhiệm vụ Thi đấu theo lớp thành công!',
      });
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err?.message || 'Không thể giao nhiệm vụ cho lớp.',
      });
    }
  };

  const handleViewAssignmentStandings = async (assign: ClassAssignmentRecord) => {
    try {
      const { standings } = await apiClient.getClassAssignmentStandings(assign.id);
      setSelectedAssignmentStandings({
        assignmentId: assign.id,
        title: assign.title,
        rows: standings,
      });
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err?.message || 'Không thể tải bảng xếp hạng nhiệm vụ lớp.',
      });
    }
  };

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.createTournament({
        title: newTourTitle || 'Giải Đấu Tri Thức Liên Khối',
        description: newTourDesc,
        roundQuestionSetIds: [newTourRound1Set, newTourRound2Set, newTourRound3Set],
      });
      setNewTourTitle('');
      setNewTourDesc('');
      await loadHubData();
      setBanner({
        type: 'success',
        text: 'Đã khởi tạo Giải đấu nhiều vòng (Vòng loại -> Bán kết -> Chung kết) thành công!',
      });
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err?.message || 'Không thể tạo giải đấu.',
      });
    }
  };

  const handleAdvanceTournament = async (tournamentId: string) => {
    try {
      const { tournament } = await apiClient.advanceTournamentRound(tournamentId);
      setTournaments((prev) =>
        prev.map((t) => (t.id === tournament.id ? tournament : t))
      );
      soundManager.playVictoryFanfare();
      setBanner({
        type: 'success',
        text:
          tournament.status === 'COMPLETED'
            ? `Giải đấu đã hoàn tất! Nhà vô địch: ${tournament.championName || 'Chưa xác định'}`
            : `Đã tổng kết vòng đấu và mở Vòng ${tournament.currentRoundNumber}!`,
      });
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err?.message || 'Không thể chuyển vòng giải đấu.',
      });
    }
  };

  const handleAdminSaveBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBadgeCode) return;
    try {
      await apiClient.adminUpdateBadge(editingBadgeCode, {
        name: editBadgeName,
        description: editBadgeDesc,
        conditionValue: editBadgeCondVal,
        xpBonus: editBadgeXp,
      });
      setEditingBadgeCode(null);
      await loadHubData();
      setBanner({
        type: 'success',
        text: 'Đã cập nhật cấu hình Huy hiệu thành công.',
      });
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err?.message || 'Không thể cập nhật huy hiệu.',
      });
    }
  };

  const renderModeIcon = (iconName: string) => {
    switch (iconName) {
      case 'Swords':
        return <Swords className="w-6 h-6 text-indigo-400" />;
      case 'UserCheck':
        return <UserCheck className="w-6 h-6 text-emerald-400" />;
      case 'Users':
        return <Users className="w-6 h-6 text-violet-400" />;
      case 'BookOpen':
        return <BookOpen className="w-6 h-6 text-teal-400" />;
      case 'Timer':
        return <Timer className="w-6 h-6 text-amber-400" />;
      case 'GraduationCap':
        return <GraduationCap className="w-6 h-6 text-blue-400" />;
      case 'CalendarCheck':
        return <CalendarCheck className="w-6 h-6 text-rose-400" />;
      default:
        return <Trophy className="w-6 h-6 text-orange-400" />;
    }
  };

  // ============================================================================
  // INTERACTIVE SESSION RUNNER VIEW (WHEN PLAYER IS IN AN ACTIVE GAME SESSION)
  // ============================================================================
  if (activeSession) {
    const currentQ = activeSession.questions[currentIdx];
    const isBookmarked = currentQ
      ? bookmarks.some((b) => b.questionId === currentQ.id)
      : false;

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Session Header Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              {activeSession.mode === 'FREE_PRACTICE'
                ? 'Chế độ Luyện tập tự do (Không áp lực xếp hạng)'
                : activeSession.mode === 'SPEED_CHALLENGE'
                  ? 'Chế độ Thử thách thời gian (Speed & Streak Bonus)'
                  : activeSession.mode === 'DAILY_CHALLENGE'
                    ? 'Chế độ Thử thách hằng ngày'
                    : activeSession.mode === 'CLASS_COMPETITION'
                      ? 'Nhiệm vụ Thi đấu theo lớp'
                      : activeSession.mode === 'TOURNAMENT'
                        ? `Giải đấu nhiều vòng (Vòng ${activeSession.roundNumber || 1})`
                        : 'Chế độ Thi đấu cá nhân'}
            </div>
            <h2 className="text-lg font-bold text-white mt-0.5">{activeSession.title}</h2>
          </div>

          <div className="flex items-center gap-4">
            {comboStreak > 0 && (
              <div className="flex items-center gap-1.5 text-amber-400 font-bold text-sm tabular-nums">
                <Flame className="w-4 h-4" />
                <span>Combo x{comboStreak}</span>
              </div>
            )}

            {remainingSessionSec !== null ? (
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono font-bold text-sm tabular-nums ${
                  remainingSessionSec <= 10
                    ? 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                    : 'bg-slate-800 border-slate-700 text-slate-200'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>{remainingSessionSec}s</span>
              </div>
            ) : (
              <div className="text-xs text-teal-400 font-medium">
                Thời gian: Không giới hạn
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setActiveSession(null);
                setSessionResult(null);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
            >
              Thoát phiên
            </button>
          </div>
        </div>

        {/* Completed Session Result Screen */}
        {sessionResult ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Kết quả chấm điểm từ máy chủ
                </div>
                <h3 className="text-2xl font-bold text-white mt-1">
                  Hoàn thành {activeSession.title}
                </h3>
              </div>
              <div className="text-right">
                <div className="text-3xl font-extrabold text-indigo-400 tabular-nums">
                  {sessionResult.totalScore.toLocaleString('vi-VN')} điểm
                </div>
                <div className="text-xs text-slate-400 tabular-nums">
                  Đúng {sessionResult.correctCount}/{sessionResult.totalQuestions} câu (
                  {sessionResult.accuracyPercent}%) • Chuỗi tối đa: {sessionResult.maxStreak}
                </div>
              </div>
            </div>

            {/* XP, Level Up & Badges Celebration */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400">Điểm kinh nghiệm (XP) nhận được</div>
                <div className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">
                  +{sessionResult.xpEarned} XP
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Tách biệt hoàn toàn với điểm bài thi chính thức
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400">Điểm thành tích & Giải đấu</div>
                <div className="text-2xl font-bold text-amber-400 mt-1 tabular-nums">
                  +{sessionResult.achievementPointsEarned} Thành tích
                  {sessionResult.tournamentPointsEarned > 0
                    ? ` • +${sessionResult.tournamentPointsEarned} Giải đấu`
                    : ''}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Cấp độ hiện tại: Cấp {sessionResult.newLevel}{' '}
                  {sessionResult.leveledUp ? '(THĂNG CẤP MỚI!)' : ''}
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400">Huy hiệu mở khóa mới</div>
                {sessionResult.newlyUnlockedBadges.length > 0 ? (
                  <div className="mt-1 space-y-1">
                    {sessionResult.newlyUnlockedBadges.map((b) => (
                      <div
                        key={b.code}
                        className="text-sm font-bold text-indigo-300 flex items-center gap-1.5"
                      >
                        <Award className="w-4 h-4 text-amber-400" />
                        <span>{b.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 mt-2">
                    Tiếp tục tích lũy để mở khóa thêm huy hiệu mới
                  </div>
                )}
              </div>
            </div>

            {/* Detailed Question Reviews */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                Chi tiết đáp án & Giải thích từng câu
              </h4>
              {sessionResult.questionReviews.map((qr, idx) => (
                <div
                  key={qr.questionId}
                  className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold text-white text-sm">
                      Câu {idx + 1}: {qr.prompt}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs font-bold tabular-nums ${
                          qr.isCorrect ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {qr.isCorrect ? `+${qr.earnedPoints} đ (Đúng)` : '0 đ (Chưa đúng)'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleBookmark(
                            qr.questionId,
                            'Đánh dấu từ màn hình kết quả để ôn tập lại'
                          )
                        }
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>Lưu sổ tay</span>
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-300">
                    Đáp án đúng:{' '}
                    <span className="font-semibold text-emerald-400">
                      {qr.options[qr.correctIndex]}
                    </span>
                    {qr.selectedIndex !== null && qr.selectedIndex !== qr.correctIndex && (
                      <span className="ml-3 text-rose-400">
                        (Bạn chọn: {qr.options[qr.selectedIndex]})
                      </span>
                    )}
                  </div>
                  {qr.explanation && (
                    <div className="text-xs text-slate-400 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                      Giải thích: {qr.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setActiveSession(null);
                  setSessionResult(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm"
              >
                Quay về Trung tâm Trò chơi
              </button>
            </div>
          </div>
        ) : currentQ ? (
          /* Active Question Card */
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300 tabular-nums">
                Câu hỏi {currentIdx + 1} / {activeSession.questions.length}
              </span>
              <div className="flex items-center gap-3">
                <span className="tabular-nums">Điểm cơ bản: {currentQ.points}</span>
                <button
                  type="button"
                  onClick={() =>
                    handleToggleBookmark(
                      currentQ.id,
                      bookmarkNoteInput || 'Câu hỏi khó cần xem lại'
                    )
                  }
                  className={`flex items-center gap-1 font-medium ${
                    isBookmarked
                      ? 'text-amber-400'
                      : 'text-slate-400 hover:text-amber-300'
                  }`}
                >
                  <Bookmark className="w-4 h-4" />
                  <span>{isBookmarked ? 'Đã đánh dấu câu khó' : 'Đánh dấu câu khó'}</span>
                </button>
              </div>
            </div>

            <div className="text-xl font-bold text-white leading-relaxed">
              {currentQ.prompt}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentQ.options.map((opt, idx) => {
                const isSelected = selectedIdx === idx;
                let borderStyle = isSelected
                  ? 'border-indigo-500 bg-indigo-950/50 text-white'
                  : 'border-slate-800 bg-slate-950/60 text-slate-200 hover:border-slate-700';

                if (practiceImmediateCheck) {
                  if (idx === practiceImmediateCheck.correctIndex) {
                    borderStyle = 'border-emerald-500 bg-emerald-950/40 text-emerald-200';
                  } else if (isSelected && !practiceImmediateCheck.isCorrect) {
                    borderStyle = 'border-rose-500 bg-rose-950/40 text-rose-200';
                  }
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectOptionInSession(idx)}
                    className={`p-4 rounded-xl border text-left transition flex items-start gap-3 ${borderStyle}`}
                  >
                    <span className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="text-sm font-medium">{opt}</span>
                  </button>
                );
              })}
            </div>

            {/* Immediate explanation in FREE_PRACTICE mode */}
            {practiceImmediateCheck && (
              <div
                className={`p-4 rounded-xl border ${
                  practiceImmediateCheck.isCorrect
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                } space-y-2`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm flex items-center gap-2">
                    {practiceImmediateCheck.isCorrect ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Chính xác! Bạn đã nắm vững kiến thức câu này.</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-rose-400" />
                        <span>Chưa chính xác. Hãy xem lời giải hoặc thử làm lại câu này.</span>
                      </>
                    )}
                  </div>
                  {!practiceImmediateCheck.isCorrect && (
                    <button
                      type="button"
                      onClick={handleRetryCurrentPracticeQuestion}
                      className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white"
                    >
                      Làm lại câu này
                    </button>
                  )}
                </div>
                <div className="text-xs text-slate-300 leading-relaxed">
                  <strong>Giải thích chi tiết:</strong> {practiceImmediateCheck.explanation}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={bookmarkNoteInput}
                  onChange={(e) => setBookmarkNoteInput(e.target.value)}
                  placeholder="Ghi chú nhanh cho câu hỏi khó..."
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 w-56"
                />
              </div>

              <button
                type="button"
                disabled={selectedIdx === null || submittingSession}
                onClick={handleConfirmAndNextInSession}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-sm flex items-center gap-2"
              >
                <span>
                  {currentIdx + 1 < activeSession.questions.length
                    ? 'Câu tiếp theo'
                    : 'Hoàn thành & Chấm điểm'}
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top XP & Level Bar + Audio/Visual Settings Toggle */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex flex-col items-center justify-center text-indigo-300 shrink-0">
            <span className="text-[10px] uppercase font-bold tracking-wider">LEVEL</span>
            <span className="text-xl font-extrabold tabular-nums">
              {xpProfile?.level || 1}
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-white">
                TRUNG TÂM CHẾ ĐỘ CHƠI & GAMIFICATION
              </h1>
              <span className="text-xs font-semibold text-indigo-400">
                • {xpProfile?.titleEquipped || 'Tân binh Tri thức'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-52 sm:w-64 h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400"
                  style={{ width: `${xpProfile?.progressPercent || 5}%` }}
                />
              </div>
              <span className="text-xs text-slate-300 font-mono tabular-nums">
                {xpProfile?.totalXp || 0} XP ({xpProfile?.currentLevelXp || 0}/
                {xpProfile?.nextLevelXpRequired || 200} lên cấp tiếp)
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-4 text-xs bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5">
            <div>
              <div className="text-slate-400">Chuỗi ngày (Streak)</div>
              <div className="text-sm font-bold text-rose-400 flex items-center gap-1 tabular-nums">
                <Flame className="w-4 h-4" />
                <span>{xpProfile?.dailyStreak || 0} ngày</span>
              </div>
            </div>
            <div className="h-7 w-px bg-slate-800" />
            <div>
              <div className="text-slate-400">Điểm thành tích</div>
              <div className="text-sm font-bold text-amber-400 tabular-nums">
                {xpProfile?.achievementPoints || 0} đ
              </div>
            </div>
            <div className="h-7 w-px bg-slate-800" />
            <div>
              <div className="text-slate-400">Điểm giải đấu</div>
              <div className="text-sm font-bold text-orange-400 tabular-nums">
                {xpProfile?.tournamentPoints || 0} đ
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAvPanel((v) => !v)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2"
          >
            {avSettings.soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
            <span>Âm thanh & Hiệu ứng</span>
          </button>
        </div>
      </div>

      {/* Section XV: Audio, Visual & Low-Spec Device Settings Bar */}
      {showAvPanel && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <span className="text-xs font-medium text-slate-300">Hiệu ứng âm thanh:</span>
            <button
              type="button"
              onClick={() => {
                const next = !avSettings.soundEnabled;
                handleUpdateAvSettings({ soundEnabled: next });
                if (next) soundManager.playCorrectAnswer();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                avSettings.soundEnabled
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {avSettings.soundEnabled ? 'Đang BẬT' : 'Đang TẮT'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-300 shrink-0">Âm lượng:</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={avSettings.volume}
              onChange={(e) =>
                handleUpdateAvSettings({ volume: parseFloat(e.target.value) })
              }
              className="w-full accent-indigo-500"
            />
            <span className="text-xs text-slate-400 tabular-nums w-9">
              {Math.round(avSettings.volume * 100)}%
            </span>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={avSettings.reducedMotion}
              onChange={(e) =>
                handleUpdateAvSettings({ reducedMotion: e.target.checked })
              }
              className="rounded border-slate-700"
            />
            <span>Giảm chuyển động (Reduced Motion)</span>
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={avSettings.lowSpecMode}
              onChange={(e) =>
                handleUpdateAvSettings({ lowSpecMode: e.target.checked })
              }
              className="rounded border-slate-700"
            />
            <span>Tối ưu thiết bị cấu hình yếu</span>
          </label>
        </div>
      )}

      {banner && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between ${
            banner.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/50 border-rose-500/40 text-rose-200'
          }`}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-slate-400 hover:text-white ml-4"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'MODES_HUB', label: '8 Chế độ chơi (Game Center)', icon: Gamepad2 },
          {
            id: 'CLASS_COMPETITION',
            label: `Thi đấu theo lớp (${classAssignments.length})`,
            icon: GraduationCap,
          },
          {
            id: 'DAILY_CHALLENGE',
            label: 'Thử thách hằng ngày',
            icon: CalendarCheck,
          },
          {
            id: 'TOURNAMENTS',
            label: `Giải đấu nhiều vòng (${tournaments.length})`,
            icon: Trophy,
          },
          {
            id: 'XP_BADGES_MISSIONS',
            label: `Huy hiệu (${badges.filter((b) => b.unlocked).length}/${badges.length}) & Nhiệm vụ`,
            icon: Award,
          },
          {
            id: 'BOOKMARKS',
            label: `Sổ tay câu hỏi khó (${bookmarks.length})`,
            icon: Bookmark,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                active
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: 8 GAME MODES VISUAL HUB                                       */}
      {/* ==================================================================== */}
      {subTab === 'MODES_HUB' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {modes.map((m) => (
            <div
              key={m.id}
              className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-5 flex flex-col justify-between transition"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                    {renderModeIcon(m.iconName)}
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-400">
                    ● Sẵn sàng hoạt động
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white">{m.title}</h3>
                  <div className="text-xs font-medium text-indigo-400 mt-0.5">
                    {m.subtitle}
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">{m.description}</p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-800/80 space-y-3">
                <div className="text-[11px] text-slate-400 space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Quy mô:</span>
                    <span className="text-slate-200 font-medium">
                      {m.supportedPlayersLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Thời lượng:</span>
                    <span className="text-slate-200 font-medium">
                      {m.estimatedDurationLabel}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openModeLauncher(m.id)}
                  className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{m.actionLabel}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: MODE 6 - CLASS COMPETITION (THI ĐẤU THEO LỚP)                 */}
      {/* ==================================================================== */}
      {subTab === 'CLASS_COMPETITION' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-base font-bold text-white">
              Danh sách Nhiệm vụ Thi đấu theo lớp
            </h2>
            {classAssignments.map((assign) => (
              <div
                key={assign.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-indigo-400">
                      Lớp: {assign.classroomName} • Bộ đề: {assign.questionSetTitle}
                    </div>
                    <h3 className="text-base font-bold text-white mt-0.5">
                      {assign.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">{assign.description}</p>
                  </div>
                  <span
                    className={`text-xs font-bold ${
                      assign.status === 'OPEN'
                        ? 'text-emerald-400'
                        : assign.status === 'UPCOMING'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                    }`}
                  >
                    {assign.status === 'OPEN'
                      ? '● Đang mở nhận bài'
                      : assign.status === 'UPCOMING'
                        ? '● Sắp mở'
                        : '● Đã đóng'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-950/60 p-3 rounded-lg border border-slate-800 tabular-nums">
                  <div>
                    <div className="text-slate-500">Hình thức</div>
                    <div className="text-slate-200 font-semibold">
                      {assign.modeType === 'PRACTICE'
                        ? 'Luyện tập lớp'
                        : 'Thi tính giờ'}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Số lần làm tối đa</div>
                    <div className="text-slate-200 font-semibold">
                      {assign.myAttemptsCount} / {assign.maxAttempts} lượt
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Tiến độ lớp</div>
                    <div className="text-slate-200 font-semibold">
                      {assign.participantCount} học sinh đã nộp
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Điểm cao nhất của bạn</div>
                    <div className="text-emerald-400 font-bold">
                      {assign.myBestScore !== null && assign.myBestScore !== undefined
                        ? `${assign.myBestScore} điểm`
                        : 'Chưa làm'}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleViewAssignmentStandings(assign)}
                    className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
                  >
                    Xem Bảng xếp hạng Lớp
                  </button>
                  {assign.status === 'OPEN' &&
                    assign.myAttemptsCount < assign.maxAttempts && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const { session } = await apiClient.startInteractiveSession({
                              mode: 'CLASS_COMPETITION',
                              referenceId: assign.id,
                            });
                            startInteractiveSessionRunner(session);
                          } catch (err: any) {
                            setBanner({
                              type: 'error',
                              text: err?.message || 'Không thể bắt đầu bài thi lớp.',
                            });
                          }
                        }}
                        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Làm bài ngay</span>
                      </button>
                    )}
                </div>
              </div>
            ))}

            {selectedAssignmentStandings && (
              <div className="bg-slate-900 border border-indigo-500/40 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">
                    Bảng xếp hạng: {selectedAssignmentStandings.title}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelectedAssignmentStandings(null)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Đóng
                  </button>
                </div>
                {selectedAssignmentStandings.rows.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Chưa có học sinh nào nộp bài cho nhiệm vụ này.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-2">Hạng</th>
                          <th className="py-2">Học sinh</th>
                          <th className="py-2 text-right">Điểm cao nhất</th>
                          <th className="py-2 text-right">Số câu đúng</th>
                          <th className="py-2 text-right">Số lượt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 tabular-nums">
                        {selectedAssignmentStandings.rows.map((r, idx) => (
                          <tr key={r.id} className="text-slate-200">
                            <td className="py-2 font-bold text-indigo-400">#{idx + 1}</td>
                            <td className="py-2 font-medium">{r.studentName}</td>
                            <td className="py-2 text-right font-bold text-emerald-400">
                              {r.bestScore}
                            </td>
                            <td className="py-2 text-right">
                              {r.correctCount}/{r.totalQuestions}
                            </td>
                            <td className="py-2 text-right">{r.attemptCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Teacher Form to Assign Class Competition */}
          {currentUser.role !== 'STUDENT' && (
            <form
              onSubmit={handleCreateClassAssignment}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 h-fit"
            >
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                <span>Giao nhiệm vụ Thi đấu theo lớp</span>
              </h3>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Tiêu đề đợt thi đua lớp
                </label>
                <input
                  type="text"
                  required
                  value={newAssignTitle}
                  onChange={(e) => setNewAssignTitle(e.target.value)}
                  placeholder="VD: Kiểm tra 15 phút Chương 1..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Chọn Lớp học</label>
                <select
                  value={newAssignClassId}
                  onChange={(e) => setNewAssignClassId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                >
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.gradeLevel})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Chọn Bộ câu hỏi
                </label>
                <select
                  value={newAssignSetId}
                  onChange={(e) => setNewAssignSetId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                >
                  {questionSets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.questionCount} câu)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Chế độ</label>
                  <select
                    value={newAssignMode}
                    onChange={(e) => setNewAssignMode(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="TIMED_COMPETITION">Thi tính giờ</option>
                    <option value="PRACTICE">Luyện tập lớp</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Số lần làm tối đa
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={newAssignMaxAttempts}
                    onChange={(e) => setNewAssignMaxAttempts(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs"
              >
                Phát hành Nhiệm vụ cho Lớp
              </button>
            </form>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: MODE 7 - DAILY CHALLENGE (THỬ THÁCH HẰNG NGÀY)                */}
      {/* ==================================================================== */}
      {subTab === 'DAILY_CHALLENGE' && dailyChallenge && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-rose-400">
                  THỬ THÁCH HẰNG NGÀY • {dailyChallenge.challengeDate}
                </div>
                <h2 className="text-xl font-bold text-white mt-1">
                  {dailyChallenge.title}
                </h2>
              </div>
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm tabular-nums">
                <Flame className="w-5 h-5" />
                <span>Chuỗi hiện tại: {dailyChallenge.currentDailyStreak} ngày</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-950/60 p-4 rounded-xl border border-slate-800 tabular-nums">
              <div>
                <div className="text-slate-400">Số lượng câu hỏi</div>
                <div className="text-base font-bold text-white mt-0.5">
                  {dailyChallenge.questionCount} câu
                </div>
              </div>
              <div>
                <div className="text-slate-400">Điểm mục tiêu</div>
                <div className="text-base font-bold text-amber-400 mt-0.5">
                  {dailyChallenge.targetScore} điểm
                </div>
              </div>
              <div>
                <div className="text-slate-400">Phần thưởng XP</div>
                <div className="text-base font-bold text-emerald-400 mt-0.5">
                  +{dailyChallenge.xpReward} XP
                </div>
              </div>
              <div>
                <div className="text-slate-400">Trạng thái hôm nay</div>
                <div className="text-base font-bold text-indigo-400 mt-0.5">
                  {dailyChallenge.alreadyCompletedToday
                    ? `Đã hoàn thành (${dailyChallenge.todayScore} đ)`
                    : 'Chưa thực hiện'}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-slate-400">
                Mỗi tài khoản chỉ được nhận thưởng Thử thách hằng ngày 1 lần duy nhất trong
                ngày để chống gian lận cộng lặp điểm.
              </p>
              <button
                type="button"
                disabled={dailyChallenge.alreadyCompletedToday}
                onClick={async () => {
                  try {
                    const { session } = await apiClient.startInteractiveSession({
                      mode: 'DAILY_CHALLENGE',
                    });
                    startInteractiveSessionRunner(session);
                  } catch (err: any) {
                    setBanner({
                      type: 'error',
                      text: err?.message || 'Không thể bắt đầu thử thách hằng ngày.',
                    });
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-semibold text-xs shrink-0"
              >
                {dailyChallenge.alreadyCompletedToday
                  ? 'Đã nhận thưởng hôm nay'
                  : 'Bắt đầu Thử thách Hôm nay'}
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white">
              Bảng vàng Thử thách Hôm nay ({dailyChallenge.challengeDate})
            </h3>
            {dailyChallenge.topCompletionsToday.length === 0 ? (
              <p className="text-xs text-slate-400">
                Hãy là người đầu tiên chinh phục thử thách ngày hôm nay!
              </p>
            ) : (
              <div className="space-y-2 tabular-nums">
                {dailyChallenge.topCompletionsToday.map((item, idx) => (
                  <div
                    key={item.userId}
                    className="flex items-center justify-between bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-rose-400">#{idx + 1}</span>
                      <span className="font-medium text-white">{item.fullName}</span>
                    </div>
                    <div className="font-bold text-emerald-400">
                      {item.score} đ ({item.correctCount} câu)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: MODE 8 - MULTI-ROUND TOURNAMENTS (GIẢI ĐẤU NHIỀU VÒNG)        */}
      {/* ==================================================================== */}
      {subTab === 'TOURNAMENTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {tournaments.map((tour) => (
              <div
                key={tour.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-orange-400">
                      GIẢI ĐẤU 3 VÒNG • {tour.classroomName}
                    </div>
                    <h3 className="text-lg font-bold text-white mt-0.5">{tour.title}</h3>
                    <p className="text-xs text-slate-400 mt-1">{tour.description}</p>
                  </div>
                  {tour.status === 'COMPLETED' ? (
                    <div className="bg-amber-950/60 border border-amber-500/40 rounded-xl px-3.5 py-2 text-right">
                      <div className="text-[10px] uppercase font-bold text-amber-300">
                        NHÀ VÔ ĐỊCH GIẢI ĐẤU
                      </div>
                      <div className="text-sm font-extrabold text-white flex items-center gap-1.5">
                        <Crown className="w-4 h-4 text-amber-400" />
                        <span>{tour.championName || 'Quán quân'}</span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-emerald-400">
                      ● Đang diễn ra Vòng {tour.currentRoundNumber}/{tour.totalRounds}
                    </span>
                  )}
                </div>

                {/* 3 Rounds Progression Stepper */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {tour.rounds.map((r) => {
                    const isCurrent =
                      tour.status === 'ACTIVE' &&
                      r.roundNumber === tour.currentRoundNumber;
                    return (
                      <div
                        key={r.roundNumber}
                        className={`p-3.5 rounded-xl border space-y-2 ${
                          isCurrent
                            ? 'bg-indigo-950/30 border-indigo-500/50'
                            : 'bg-slate-950/60 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">
                            Vòng {r.roundNumber}: {r.roundName}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-400">
                            {r.status === 'OPEN'
                              ? 'Đang mở'
                              : r.status === 'COMPLETED'
                                ? 'Đã xong'
                                : 'Chờ mở'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Đề: {r.questionSetTitle} • Lấy Top {r.qualifyTopCount}
                        </div>
                        {r.standings.length > 0 && (
                          <div className="space-y-1 pt-1 border-t border-slate-800/80 tabular-nums">
                            {r.standings.slice(0, 3).map((s, idx) => (
                              <div
                                key={s.userId}
                                className="flex items-center justify-between text-[11px]"
                              >
                                <span className="text-slate-300 truncate">
                                  #{idx + 1} {s.fullName}
                                </span>
                                <span className="font-bold text-emerald-400">
                                  {s.score} đ
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                  {currentUser.role !== 'STUDENT' && tour.status === 'ACTIVE' && (
                    <button
                      type="button"
                      onClick={() => handleAdvanceTournament(tour.id)}
                      className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs"
                    >
                      {tour.currentRoundNumber < tour.totalRounds
                        ? `Chốt kết quả & Mở Vòng ${tour.currentRoundNumber + 1}`
                        : 'Tổng kết Chung kết & Vinh danh Nhà vô địch'}
                    </button>
                  )}

                  {tour.status === 'ACTIVE' && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const { session } = await apiClient.startInteractiveSession({
                            mode: 'TOURNAMENT',
                            referenceId: tour.id,
                          });
                          startInteractiveSessionRunner(session);
                        } catch (err: any) {
                          setBanner({
                            type: 'error',
                            text: err?.message || 'Không thể vào vòng thi giải đấu.',
                          });
                        }
                      }}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Thi đấu Vòng {tour.currentRoundNumber} ngay</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {currentUser.role !== 'STUDENT' && (
            <form
              onSubmit={handleCreateTournament}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 h-fit"
            >
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-orange-400" />
                <span>Tạo Giải đấu 3 vòng mới</span>
              </h3>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Tên giải đấu</label>
                <input
                  type="text"
                  required
                  value={newTourTitle}
                  onChange={(e) => setNewTourTitle(e.target.value)}
                  placeholder="VD: Đấu Trường Tri Thức Cấp Trường..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Bộ đề Vòng 1 (Vòng loại)
                </label>
                <select
                  value={newTourRound1Set}
                  onChange={(e) => setNewTourRound1Set(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                >
                  {questionSets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Bộ đề Vòng 2 (Bán kết)
                </label>
                <select
                  value={newTourRound2Set}
                  onChange={(e) => setNewTourRound2Set(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                >
                  {questionSets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Bộ đề Vòng 3 (Chung kết)
                </label>
                <select
                  value={newTourRound3Set}
                  onChange={(e) => setNewTourRound3Set(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                >
                  {questionSets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs"
              >
                Khởi tạo Giải đấu
              </button>
            </form>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 5: SECTIONS XI, XII, XIV - XP, 8 BADGES & LEARNING MISSIONS      */}
      {/* ==================================================================== */}
      {subTab === 'XP_BADGES_MISSIONS' && (
        <div className="space-y-6">
          {/* 8 Mandatory Badges Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">
                Hệ thống 8 Huy hiệu & Thành tích học tập
              </h2>
              {currentUser.role === 'ADMIN' && (
                <span className="text-xs text-indigo-400">
                  Quản trị viên có thể nhấn "Chỉnh sửa điều kiện" trên từng huy hiệu
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {badges.map((b) => (
                <div
                  key={b.code}
                  className={`rounded-xl p-4 border transition flex flex-col justify-between ${
                    b.unlocked
                      ? 'bg-slate-900 border-amber-500/50'
                      : 'bg-slate-900/50 border-slate-800 opacity-75'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          b.unlocked
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        <Award className="w-5 h-5" />
                      </div>
                      <span
                        className={`text-xs font-bold tabular-nums ${
                          b.unlocked ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        {b.unlocked ? '● Đã đạt được' : 'Chưa mở khóa'}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white">{b.name}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {b.description}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-amber-400 font-bold tabular-nums">
                      Thưởng: +{b.xpBonus} XP
                    </span>
                    {currentUser.role === 'ADMIN' && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBadgeCode(b.code);
                          setEditBadgeName(b.name);
                          setEditBadgeDesc(b.description);
                          setEditBadgeCondVal(b.conditionValue);
                          setEditBadgeXp(b.xpBonus);
                        }}
                        className="text-indigo-400 hover:text-indigo-300 font-medium"
                      >
                        Chỉnh sửa
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {editingBadgeCode && (
              <form
                onSubmit={handleAdminSaveBadge}
                className="bg-slate-900 border border-indigo-500/50 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase text-indigo-400">
                    Quản trị viên chỉnh sửa huy hiệu ({editingBadgeCode})
                  </h4>
                  <button
                    type="button"
                    onClick={() => setEditingBadgeCode(null)}
                    className="text-xs text-slate-400"
                  >
                    Đóng
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    value={editBadgeName}
                    onChange={(e) => setEditBadgeName(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                    placeholder="Tên huy hiệu"
                  />
                  <input
                    type="text"
                    value={editBadgeDesc}
                    onChange={(e) => setEditBadgeDesc(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white sm:col-span-2"
                    placeholder="Mô tả điều kiện"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={editBadgeCondVal}
                      onChange={(e) => setEditBadgeCondVal(Number(e.target.value))}
                      className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                      title="Chỉ tiêu điều kiện"
                    />
                    <input
                      type="number"
                      min={10}
                      value={editBadgeXp}
                      onChange={(e) => setEditBadgeXp(Number(e.target.value))}
                      className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                      title="Thưởng XP"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold"
                    >
                      Lưu
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* Learning Missions & XP Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              <h2 className="text-base font-bold text-white">
                Nhiệm vụ Học tập & Phần thưởng lành mạnh (Không tiền ảo / Không Pay-to-Win)
              </h2>
              <div className="space-y-3">
                {missions.map((m) => {
                  const pct = Math.min(
                    100,
                    Math.round((m.currentValue / Math.max(1, m.targetValue)) * 100)
                  );
                  return (
                    <div
                      key={m.code}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1 min-w-[240px]">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-white">{m.title}</h3>
                          <span className="text-xs font-mono text-slate-400 tabular-nums">
                            {m.currentValue} / {m.targetValue}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{m.description}</p>
                        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className="h-full bg-indigo-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right text-xs tabular-nums">
                          <div className="font-bold text-emerald-400">+{m.xpReward} XP</div>
                          <div className="text-amber-400">
                            +{m.achievementReward} Thành tích
                          </div>
                          {m.rewardTitle && (
                            <div className="text-[11px] text-indigo-300">
                              Danh hiệu: {m.rewardTitle}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={!m.isCompleted || m.isClaimed}
                          onClick={() => handleClaimMission(m.code)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold ${
                            m.isClaimed
                              ? 'bg-slate-800 text-slate-500'
                              : m.isCompleted
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                : 'bg-slate-800 text-slate-400 opacity-50'
                          }`}
                        >
                          {m.isClaimed
                            ? 'Đã nhận'
                            : m.isCompleted
                              ? 'Nhận thưởng'
                              : 'Đang thực hiện'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* XP History Log */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 h-fit">
              <h3 className="text-sm font-bold text-white">
                Nhật ký Thăng cấp & Lịch sử cộng XP
              </h3>
              {!xpProfile || xpProfile.recentXpLogs.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Chưa có lịch sử nhận XP. Hãy tham gia một chế độ chơi để bắt đầu tích
                  lũy!
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto tabular-nums">
                  {xpProfile.recentXpLogs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-400">
                          +{log.xpDelta} XP
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(log.createdAt).toLocaleString('vi-VN')}
                        </span>
                      </div>
                      <div className="text-slate-300">{log.reason}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 6: BOOKMARKS (SỔ TAY CÂU HỎI KHÓ TRONG LUYỆN TẬP TỰ DO)          */}
      {/* ==================================================================== */}
      {subTab === 'BOOKMARKS' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-white">
            Sổ tay Câu hỏi khó đã đánh dấu ({bookmarks.length})
          </h2>
          {bookmarks.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-2">
              <p className="text-sm text-slate-300 font-semibold">
                Bạn chưa đánh dấu câu hỏi khó nào.
              </p>
              <p className="text-xs text-slate-400">
                Trong chế độ Luyện tập tự do hoặc màn hình kết quả, hãy nhấn "Đánh dấu câu
                khó" để lưu lại ôn tập.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bookmarks.map((bm) => (
                <div
                  key={bm.questionId}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-indigo-400 font-semibold">
                      {bm.subject} • {bm.topic}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleBookmark(bm.questionId)}
                      className="text-rose-400 hover:text-rose-300"
                    >
                      Bỏ đánh dấu
                    </button>
                  </div>
                  <div className="text-sm font-bold text-white">{bm.prompt}</div>
                  <div className="text-xs text-emerald-400 font-medium">
                    Đáp án đúng: {bm.options[bm.correctIndex]}
                  </div>
                  {bm.explanation && (
                    <div className="text-xs text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      Giải thích: {bm.explanation}
                    </div>
                  )}
                  {bm.note && (
                    <div className="text-[11px] text-amber-300">
                      Ghi chú cá nhân: {bm.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* PRE-GAME CONFIGURATION MODAL (SECTION III, IV, V, VI, VII, XVI)      */}
      {/* ==================================================================== */}
      {configuringMode && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <form
            onSubmit={handleLaunchConfiguredMode}
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="text-xs font-bold uppercase text-indigo-400">
                  Cấu hình trước trận đấu
                </div>
                <h3 className="text-lg font-bold text-white">
                  {modes.find((m) => m.id === configuringMode)?.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConfiguringMode(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Đóng
              </button>
            </div>

            {(configuringMode === 'LIVE_ARENA' || configuringMode === 'TEAM_ARENA') && (
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <label className="block text-xs font-semibold text-indigo-300">
                  Tham gia nhanh bằng mã PIN phòng có sẵn (nếu có)
                </label>
                <input
                  type="text"
                  value={cfgJoinPin}
                  onChange={(e) => setCfgJoinPin(e.target.value)}
                  placeholder="Nhập mã PIN 6 số để vào thẳng phòng (bỏ trống nếu tạo phòng mới)..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            )}

            {!cfgJoinPin.trim() && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Chọn Bộ câu hỏi
                  </label>
                  <select
                    value={cfgSetId}
                    onChange={(e) => setCfgSetId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    {questionSets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({s.subject} - Khối {s.gradeLevel} - {s.questionCount}{' '}
                        câu)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Số lượng câu hỏi
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={cfgQuestionCount}
                      onChange={(e) => setCfgQuestionCount(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Lọc độ khó
                    </label>
                    <select
                      value={cfgDifficulty}
                      onChange={(e) => setCfgDifficulty(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      <option value="ALL">Tất cả mức độ khó</option>
                      <option value="EASY">Cơ bản (Easy)</option>
                      <option value="MEDIUM">Trung bình (Medium)</option>
                      <option value="HARD">Nâng cao (Hard)</option>
                    </select>
                  </div>
                </div>

                {configuringMode === 'FREE_PRACTICE' && (
                  <label className="flex items-center gap-2 text-xs text-teal-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={cfgUnlimitedTime}
                      onChange={(e) => setCfgUnlimitedTime(e.target.checked)}
                    />
                    <span>
                      Không giới hạn thời gian & hiển thị giải thích chi tiết ngay sau mỗi
                      câu
                    </span>
                  </label>
                )}

                {(!cfgUnlimitedTime || configuringMode !== 'FREE_PRACTICE') &&
                  configuringMode !== 'LIVE_ARENA' &&
                  configuringMode !== 'TEAM_ARENA' && (
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Tổng thời gian giới hạn (giây)
                      </label>
                      <input
                        type="number"
                        min={30}
                        max={1800}
                        value={cfgTimeLimitSec}
                        onChange={(e) => setCfgTimeLimitSec(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                  )}

                {(configuringMode === 'LIVE_ARENA' ||
                  configuringMode === 'TEAM_ARENA') && (
                  <div className="space-y-3 pt-2 border-t border-slate-800">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Tên phòng thi đấu
                      </label>
                      <input
                        type="text"
                        value={cfgRoomTitle}
                        onChange={(e) => setCfgRoomTitle(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Số người chơi tối đa
                        </label>
                        <input
                          type="number"
                          min={2}
                          max={100}
                          value={cfgMaxParticipants}
                          onChange={(e) => setCfgMaxParticipants(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Chính sách hiển thị đáp án
                        </label>
                        <select
                          value={cfgRevealPolicy}
                          onChange={(e) => setCfgRevealPolicy(e.target.value as any)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                        >
                          <option value="IMMEDIATE">Hiện ngay sau mỗi câu</option>
                          <option value="END_OF_MATCH">Ẩn đến cuối trận đấu</option>
                        </select>
                      </div>
                    </div>

                    {configuringMode === 'TEAM_ARENA' && (
                      <div className="grid grid-cols-2 gap-3 bg-violet-950/20 border border-violet-500/30 rounded-xl p-3">
                        <div>
                          <label className="block text-xs text-violet-300 mb-1">
                            Số lượng đội khởi tạo
                          </label>
                          <input
                            type="number"
                            min={2}
                            max={8}
                            value={cfgTeamCount}
                            onChange={(e) => setCfgTeamCount(Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-violet-300 mb-1">
                            Cơ chế tính điểm đồng đội
                          </label>
                          <select
                            value={cfgTeamFormat}
                            onChange={(e) => setCfgTeamFormat(e.target.value as any)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                          >
                            <option value="ALL_MEMBERS_SCORE">
                              Mọi thành viên trả lời (Chuẩn hóa theo quy mô đội)
                            </option>
                            <option value="CAPTAIN_REPRESENTATIVE">
                              Đội trưởng đại diện chốt đáp án
                            </option>
                            <option value="TURN_BY_TURN">
                              Luân phiên theo lượt từng thành viên
                            </option>
                            <option value="TEAM_CONSENSUS">
                              Đồng thuận đội (Đa số chọn đúng + Thưởng đồng thuận)
                            </option>
                          </select>
                        </div>
                      </div>
                    )}

                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cfgAllowRejoin}
                        onChange={(e) => setCfgAllowRejoin(e.target.checked)}
                      />
                      <span>
                        Cho phép học sinh tự động kết nối lại khi rớt mạng (Reconnect)
                      </span>
                    </label>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfiguringMode(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Khởi chạy Chế độ chơi</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
