export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

export interface RoleEntity {
  id: string;
  code: UserRole;
  name: string;
  description: string;
  permissions: string[];
  createdAt: string;
}

export interface UserProfile {
  id: string;
  username?: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  role: UserRole;
  schoolName: string;
  className?: string;
  bio: string;
  isLocked: boolean;
  createdAt: string;
}

export interface Classroom {
  id: string;
  code: string;
  name: string;
  subject: string;
  gradeLevel: string;
  description: string;
  teacherId: string;
  teacherName: string;
  studentCount: number;
  isLocked?: boolean;
  activityCount?: number;
  createdAt: string;
}

export interface ClassroomMember {
  id: string;
  classroomId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentUsername?: string;
  schoolName?: string;
  isLocked?: boolean;
  joinedAt: string;
}

export type QuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'FILL_IN_BLANK'
  | 'SHORT_ANSWER'
  | 'MATCHING'
  | 'ORDERING'
  | 'IMAGE_CHOICE'
  | 'IMAGE_RECOGNITION'
  | 'AUDIO_QUESTION'
  | 'VIDEO_QUESTION'
  | 'ESSAY';

export type CognitiveLevel =
  | 'REMEMBER'
  | 'UNDERSTAND'
  | 'APPLY'
  | 'HIGH_APPLY';

export type DifficultyLevel =
  | 'EASY'
  | 'MEDIUM'
  | 'HARD'
  | 'VERY_HARD';

export type QuestionUsageStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';

export interface MatchingPairItem {
  left: string;
  right: string;
}

export interface QuestionCategory {
  id: string;
  name?: string;
  educationLevel: string;
  gradeLevel: string;
  subject: string;
  topic: string;
  lesson: string;
  description?: string;
  creatorId: string;
  creatorName: string;
  createdAt: string;
}

export interface QuestionOptionEntity {
  id: string;
  questionId: string;
  optionIndex: number;
  optionText: string;
}

export interface PublicQuestion {
  id: string;
  questionCode?: string;
  questionSetId: string;
  orderIndex: number;
  questionType?: QuestionType;
  prompt: string;
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  options: string[];
  timeLimitSec: number;
  points: number;
  educationLevel?: string;
  gradeLevel?: string;
  subject?: string;
  topic?: string;
  lesson?: string;
  cognitiveLevel?: CognitiveLevel;
  difficulty?: DifficultyLevel;
  usageStatus?: QuestionUsageStatus;
  creatorId?: string;
  creatorName?: string;
  createdAt?: string;
  updatedAt?: string;
  isArenaSupported?: boolean;
  requiresManualGrading?: boolean;
}

export interface FullQuestion extends PublicQuestion {
  correctIndex: number;
  correctIndices?: number[];
  correctAnswerText?: string;
  matchingPairs?: MatchingPairItem[];
  orderingItems?: string[];
  explanation: string;
}

export interface QuestionSet {
  id: string;
  title: string;
  subject: string;
  gradeLevel: string;
  educationLevel?: string;
  topic?: string;
  description: string;
  creatorId: string;
  creatorName: string;
  isPublic: boolean;
  sharedWithIds?: string[];
  defaultPoints?: number;
  defaultTimeLimitSec?: number;
  questionCount: number;
  arenaSupportedCount?: number;
  updatedAt?: string;
  createdAt: string;
}

export interface QuestionQualityIssue {
  questionId: string;
  questionCode?: string;
  prompt: string;
  severity: 'WARNING' | 'ERROR';
  issueType:
    | 'DUPLICATE_PROMPT'
    | 'MISSING_OPTIONS'
    | 'INVALID_CORRECT_ANSWER'
    | 'AMBIGUOUS_WORDING'
    | 'DIFFICULTY_MISMATCH'
    | 'TOPIC_MISMATCH'
    | 'SPELLING_OR_CLARITY';
  message: string;
  suggestion?: string;
  suggestedFix?: {
    prompt?: string;
    options?: string[];
    explanation?: string;
    difficulty?: DifficultyLevel;
    cognitiveLevel?: CognitiveLevel;
  };
}

export interface AiProviderStatus {
  configured: boolean;
  isConfigured?: boolean;
  providerName: string;
  modelName: string;
  modelAlias?: string;
  rateLimitPerMinute: number;
  remainingCallsThisMinute: number;
  remainingRequestsPerMinute?: number;
  manualFallbackAvailable: boolean;
  notice: string;
  message?: string;
}

export interface GeneratedDraftQuestion {
  questionType: QuestionType;
  prompt: string;
  options: string[];
  correctIndex: number;
  correctIndices: number[];
  correctAnswerText?: string;
  matchingPairs?: MatchingPairItem[];
  orderingItems?: string[];
  explanation: string;
  educationLevel: string;
  gradeLevel: string;
  subject: string;
  topic: string;
  lesson?: string;
  cognitiveLevel: CognitiveLevel;
  difficulty: DifficultyLevel;
  timeLimitSec: number;
  points: number;
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
}

export type RoomStatus =
  | 'LOBBY'
  | 'QUESTION_ACTIVE'
  | 'PAUSED'
  | 'QUESTION_REVEAL'
  | 'FINISHED';

export type GameMode = 'SPEED_PRECISION' | 'STANDARD' | 'HIGH_STAKES';

export type RoomAccessPolicy = 'ANY_AUTHENTICATED' | 'CLASSROOM_ONLY' | 'ALLOW_GUEST';

export type RealtimeEventType =
  | 'player:join'
  | 'player:leave'
  | 'player:reconnect'
  | 'room:updated'
  | 'game:started'
  | 'question:started'
  | 'answer:submitted'
  | 'answer:result'
  | 'timer:updated'
  | 'leaderboard:updated'
  | 'game:paused'
  | 'game:resumed'
  | 'game:finished';

export interface RoomParticipant {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  teamId?: string | null;
  teamName?: string | null;
  teamColorHex?: string | null;
  isTeamCaptain?: boolean;
  score: number;
  correctCount: number;
  answeredCount?: number;
  avgResponseTimeMs?: number;
  streak: number;
  hasAnsweredCurrent: boolean;
  lastEarnedPoints: number;
  lastSelectedIndex: number | null;
  lastSelectedIndices?: number[];
  lastAnswerCorrect: boolean | null;
  isOnline: boolean;
}

export interface RoomAnswerDistribution {
  counts: number[];
  totalAnswers: number;
}

export interface LiveRoomState {
  id: string;
  sessionId?: string;
  code: string;
  title: string;
  description?: string;
  questionSetId: string;
  questionSetTitle: string;
  classroomId: string | null;
  hostId: string;
  hostName: string;
  isTestMode: boolean;
  gameMode?: GameMode;
  accessPolicy?: RoomAccessPolicy;
  isPublic?: boolean;
  isJoinLocked?: boolean;
  timeLimitOverrideSec?: number | null;
  pointsOverride?: number | null;
  maxParticipants?: number;
  isTeamMode?: boolean;
  teamPlayFormat?: TeamPlayFormat;
  teams?: ArenaTeam[];
  revealAnswersPolicy?: 'IMMEDIATE' | 'END_OF_MATCH';
  publicLeaderboardPolicy?: boolean;
  allowRejoinPolicy?: boolean;
  maxAttemptsPerPlayer?: number;
  status: RoomStatus;
  currentQuestionIndex: number;
  totalQuestions: number;
  questionStartedAt: number | null;
  questionEndsAt: number | null;
  pausedRemainingMs?: number | null;
  serverTimeMs: number;
  lastEventType?: RealtimeEventType;
  currentQuestion: PublicQuestion | null;
  revealedCorrectIndex: number | null;
  revealedCorrectIndices?: number[] | null;
  revealedExplanation: string | null;
  answerDistribution: RoomAnswerDistribution | null;
  participants: RoomParticipant[];
}

export interface MatchHistoryRecord {
  id: string;
  roomCode: string;
  roomTitle: string;
  questionSetTitle: string;
  hostName: string;
  finishedAt: string;
  participantCount: number;
  userScore?: number;
  userRank?: number;
  userCorrectCount?: number;
  totalQuestions: number;
}

export interface MatchSubmissionDetail {
  questionIndex: number;
  prompt: string;
  options: string[];
  selectedIndex: number | null;
  correctIndex: number;
  isCorrect: boolean;
  earnedPoints: number;
  responseTimeMs: number;
  explanation: string;
}

export interface LeaderboardEntry {
  userId: string;
  fullName: string;
  schoolName: string;
  role: UserRole;
  totalScore: number;
  matchesPlayed: number;
  totalCorrect: number;
  totalAnswered: number;
  accuracyPercent: number;
  totalXp?: number;
  level?: number;
  achievementPoints?: number;
  tournamentPoints?: number;
  isAnonymous?: boolean;
}

export interface ActivityLogRecord {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  module: string;
  targetId: string;
  details: string;
  createdAt: string;
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ReportSummary {
  totalSessions: number;
  totalPlayerAnswers: number;
  averageAccuracyPercent: number;
  averageResponseTimeMs: number;
  subjectBreakdown: Array<{
    subject: string;
    quizCount: number;
    questionCount: number;
  }>;
  recentActivityLogs: ActivityLogRecord[];
}

export interface TeacherDetailStats {
  teacher: UserProfile;
  classrooms: Classroom[];
  questionSetCount: number;
  hostedMatchCount: number;
  recentActivities: ActivityLogRecord[];
}

export interface StudentAchievementDetail {
  student: UserProfile;
  enrolledClassrooms: Classroom[];
  totalScore: number;
  matchesPlayed: number;
  totalCorrect: number;
  totalAnswered: number;
  accuracyPercent: number;
  recentMatches: MatchHistoryRecord[];
}

export interface StudentImportRowInput {
  rowNumber: number;
  fullName: string;
  email: string;
  username?: string;
  schoolName?: string;
  classroomCode?: string;
  password?: string;
}

export interface StudentImportResult {
  importedCount: number;
  enrolledCount: number;
  skippedCount: number;
  errors: Array<{ rowNumber: number; email: string; message: string }>;
  createdStudents: UserProfile[];
}

export interface RoleDashboardSummary {
  role: UserRole;
  adminMetrics?: {
    totalUsers: number;
    teacherCount: number;
    studentCount: number;
    classroomCount: number;
    totalRoomsCount: number;
    totalParticipations: number;
    recentActivities: ActivityLogRecord[];
  };
  teacherMetrics?: {
    managedClassCount: number;
    totalStudentsInClasses: number;
    questionSetCount: number;
    quizCount: number;
    hostedRoomCount: number;
    recentClassResults: MatchHistoryRecord[];
  };
  studentMetrics?: {
    joinedClassCount: number;
    activeRoomCount: number;
    personalTotalScore: number;
    matchesPlayed: number;
    accuracyPercent: number;
    personalRank: number | null;
    recentMatches: MatchHistoryRecord[];
    topLeaderboard: LeaderboardEntry[];
  };
}

export interface SystemArchitectureDiagnostics {
  databaseEngine: string;
  repositoryAdapter: string;
  realtimeEngine: string;
  maxConcurrentPerRoom: number;
  activeWebSocketClients: number;
  activeLiveRooms: number;
  totalUsers: number;
  totalQuestionSets: number;
  totalQuestions: number;
  totalMatchesCompleted: number;
  totalActivityLogs?: number;
  standardizedModules?: string[];
  databaseEntities?: string[];
  adminInitialized: boolean;
  concurrencyLimitsNote: string;
}

// ============================================================================
// PROMPT 5: GAME MODES & GAMIFICATION TYPES
// ============================================================================

export type PlayModeCategory =
  | 'LIVE_ARENA'
  | 'SOLO_COMPETITIVE'
  | 'TEAM_ARENA'
  | 'FREE_PRACTICE'
  | 'SPEED_CHALLENGE'
  | 'CLASS_COMPETITION'
  | 'DAILY_CHALLENGE'
  | 'TOURNAMENT';

export type TeamPlayFormat =
  | 'ALL_MEMBERS_SCORE'
  | 'CAPTAIN_REPRESENTATIVE'
  | 'TURN_BY_TURN'
  | 'TEAM_CONSENSUS';

export interface ArenaTeam {
  id: string;
  name: string;
  colorHex: string;
  colorName: string;
  captainUserId: string | null;
  activeTurnUserId?: string | null;
  totalScore: number;
  memberCount: number;
  correctCount: number;
  memberUserIds: string[];
}

export interface GameModeCardInfo {
  id: PlayModeCategory;
  title: string;
  subtitle: string;
  description: string;
  playersSupported?: string;
  supportedPlayersLabel: string;
  estimatedDuration?: string;
  estimatedDurationLabel: string;
  status: 'AVAILABLE' | 'TEACHER_CONTROLLED';
  teacherControlled?: boolean;
  accentColor?: string;
  actionLabel: string;
  iconName: string;
}

export interface ClassAssignmentRecord {
  id: string;
  title: string;
  description: string;
  classroomId: string;
  classroomName: string;
  questionSetId: string;
  questionSetTitle: string;
  teacherId: string;
  teacherName: string;
  modeType: 'PRACTICE' | 'TIMED_COMPETITION';
  assignmentType?: 'PRACTICE' | 'TIMED_EXAM';
  openAt: string;
  closeAt: string;
  opensAt?: string;
  closesAt?: string;
  maxAttempts: number;
  timeLimitSec: number;
  timeLimitSecPerQuestion?: number;
  isPublishedResults: boolean;
  isResultsPublished?: boolean;
  status: 'UPCOMING' | 'OPEN' | 'CLOSED';
  participantCount: number;
  submittedCount?: number;
  totalStudentsInClass: number;
  myAttemptsCount: number;
  myBestScore: number | null;
  myLastStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED';
  createdAt: string;
}

export interface ClassAssignmentSubmissionRecord {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  attemptCount: number;
  bestScore: number;
  correctCount: number;
  totalQuestions: number;
  totalTimeMs: number;
  status: string;
  submittedAt: string | null;
}

export interface DailyChallengeInfo {
  challengeDate: string;
  title: string;
  subject: string;
  topic?: string;
  questionSetId: string;
  questionSetTitle?: string;
  questionCount: number;
  timeLimitSec?: number;
  targetScore: number;
  xpReward: number;
  achievementPointsReward: number;
  alreadyCompletedToday: boolean;
  currentDailyStreak: number;
  todayScore?: number | null;
  todayCorrectCount?: number | null;
  topCompletionsToday: Array<{
    userId: string;
    fullName: string;
    score: number;
    correctCount: number;
    completedAt: string;
  }>;
}

export interface TournamentRoundInfo {
  roundNumber: number;
  roundName: 'Vòng loại' | 'Bán kết' | 'Chung kết' | string;
  questionSetId: string;
  questionSetTitle: string;
  questionCount: number;
  timeLimitSec: number;
  qualifyTopCount: number;
  minScoreToAdvance: number;
  status: 'PENDING' | 'OPEN' | 'COMPLETED';
  standings: Array<{
    userId: string;
    fullName: string;
    schoolName: string;
    score: number;
    correctCount: number;
    responseTimeMs: number;
    qualifiedForNext: boolean;
    completedAt: string;
  }>;
}

export interface TournamentRecord {
  id: string;
  title: string;
  description: string;
  classroomId: string | null;
  classroomName: string;
  creatorId: string;
  creatorName: string;
  currentRoundNumber: number;
  totalRounds: number;
  status: 'ACTIVE' | 'COMPLETED';
  rounds: TournamentRoundInfo[];
  championUserId?: string | null;
  championName?: string | null;
  createdAt: string;
}

export interface XpProfileSummary {
  userId: string;
  totalXp: number;
  level: number;
  levelTitle: string;
  levelBadgeCode: string;
  currentLevelXp: number;
  nextLevelXpRequired: number;
  progressPercent: number;
  achievementPoints: number;
  tournamentPoints: number;
  dailyStreak: number;
  practiceCount: number;
  speedChallengeBestScore: number;
  titleEquipped: string;
  recentXpLogs: Array<{
    id: string;
    sourceType: string;
    xpDelta: number;
    achievementDelta: number;
    reason: string;
    createdAt: string;
  }>;
}

export interface BadgeDefinitionRecord {
  id: string;
  code: string;
  name: string;
  iconName: string;
  description: string;
  conditionType: string;
  conditionValue: number;
  xpBonus: number;
  unlocked?: boolean;
  unlockedAt?: string | null;
}

export interface LearningMissionRecord {
  id: string;
  code: string;
  title: string;
  description: string;
  missionType:
    | 'COMPLETE_PRACTICE'
    | 'CORRECT_ANSWERS'
    | 'JOIN_MATCH'
    | 'COMPLETE_DAILY'
    | 'REACH_SCORE';
  targetValue: number;
  currentValue: number;
  xpReward: number;
  achievementReward: number;
  rewardTitle?: string;
  isCompleted: boolean;
  isClaimed: boolean;
}

export interface BookmarkedQuestionRecord {
  questionId: string;
  questionCode: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  subject: string;
  topic: string;
  note: string;
  createdAt: string;
}

export interface SoloOrPracticeSessionPayload {
  sessionId: string;
  mode:
    | 'SOLO_COMPETITIVE'
    | 'FREE_PRACTICE'
    | 'SPEED_CHALLENGE'
    | 'DAILY_CHALLENGE'
    | 'CLASS_COMPETITION'
    | 'TOURNAMENT';
  title: string;
  questionSetId: string;
  questionSetTitle: string;
  totalTimeLimitSec: number | null;
  perQuestionTimeLimitSec: number;
  showExplanationImmediately: boolean;
  questions: PublicQuestion[];
  referenceId?: string;
  roundNumber?: number;
}

export interface SoloOrPracticeResultSummary {
  sessionId: string;
  mode: string;
  totalScore: number;
  correctCount: number;
  totalQuestions: number;
  accuracyPercent: number;
  maxStreak: number;
  totalResponseTimeMs: number;
  xpEarned: number;
  achievementPointsEarned: number;
  tournamentPointsEarned: number;
  leveledUp: boolean;
  newLevel: number;
  newlyUnlockedBadges: BadgeDefinitionRecord[];
  questionReviews: Array<{
    questionId: string;
    prompt: string;
    options: string[];
    selectedIndex: number | null;
    correctIndex: number;
    isCorrect: boolean;
    earnedPoints: number;
    explanation: string;
  }>;
}

