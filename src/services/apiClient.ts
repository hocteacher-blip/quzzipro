import type {
  ActivityLogRecord,
  AiProviderStatus,
  BadgeDefinitionRecord,
  BookmarkedQuestionRecord,
  ClassAssignmentRecord,
  ClassAssignmentSubmissionRecord,
  Classroom,
  ClassroomMember,
  CognitiveLevel,
  DailyChallengeInfo,
  DifficultyLevel,
  FullQuestion,
  GameMode,
  GameModeCardInfo,
  GeneratedDraftQuestion,
  LeaderboardEntry,
  LearningMissionRecord,
  LiveRoomState,
  MatchHistoryRecord,
  MatchSubmissionDetail,
  MatchingPairItem,
  PaginationMetadata,
  PublicQuestion,
  QuestionCategory,
  QuestionQualityIssue,
  QuestionSet,
  QuestionType,
  QuestionUsageStatus,
  ReportSummary,
  RoleDashboardSummary,
  RoleEntity,
  RoomAccessPolicy,
  RoomStatus,
  SoloOrPracticeResultSummary,
  SoloOrPracticeSessionPayload,
  StudentAchievementDetail,
  StudentImportResult,
  StudentImportRowInput,
  SystemArchitectureDiagnostics,
  TeacherDetailStats,
  TeamPlayFormat,
  TournamentRecord,
  UserProfile,
  UserRole,
  XpProfileSummary,
} from '../types/arena.ts';

// Held strictly in JS memory per security guidelines (never stored in localStorage/sessionStorage)
let inMemoryAuthToken: string | null = null;

export function setAuthToken(token: string | null): void {
  inMemoryAuthToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryAuthToken;
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (inMemoryAuthToken) {
    headers['Authorization'] = `Bearer ${inMemoryAuthToken}`;
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Yêu cầu thất bại (Mã ${response.status})`);
  }
  return data as T;
}

export const api = {
  getBootstrapStatus: () =>
    requestJson<{ adminInitialized: boolean; passcodeConfigured: boolean }>(
      '/api/auth/bootstrap-status'
    ),

  register: (payload: {
    email: string;
    username?: string;
    fullName: string;
    password: string;
    role: 'TEACHER' | 'STUDENT';
    schoolName: string;
    className?: string;
  }) =>
    requestJson<{ token: string; user: UserProfile }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    requestJson<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  changePassword: (payload: { currentPassword?: string; newPassword: string }) =>
    requestJson<{ success: boolean; message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  requestPasswordReset: (email: string) =>
    requestJson<{
      success: boolean;
      email: string;
      expiresAt: string;
      sandboxResetCode?: string;
      message: string;
    }>('/api/auth/request-password-reset', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (payload: { email: string; resetCode: string; newPassword: string }) =>
    requestJson<{ token: string; user: UserProfile; message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  claimAdmin: (payload: {
    email: string;
    fullName: string;
    password: string;
    adminPasscode?: string;
  }) =>
    requestJson<{ token: string; user: UserProfile }>('/api/auth/claim-admin', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  startDemoSession: (role: 'TEACHER' | 'STUDENT') =>
    requestJson<{ token: string; user: UserProfile }>('/api/auth/demo-session', {
      method: 'POST',
      body: JSON.stringify({ role }),
    }),

  updateProfile: (payload: {
    fullName: string;
    username?: string;
    avatarUrl?: string;
    schoolName: string;
    className?: string;
    bio: string;
    newPassword?: string;
  }) =>
    requestJson<{ user: UserProfile }>('/api/users/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // Student Management & Bulk CSV Import
  listStudents: (params?: {
    search?: string;
    classroomId?: string;
    status?: 'ALL' | 'ACTIVE' | 'LOCKED';
    page?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.classroomId) q.set('classroomId', params.classroomId);
    if (params?.status) q.set('status', params.status);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return requestJson<{ students: UserProfile[]; pagination: PaginationMetadata }>(
      `/api/users/students?${q.toString()}`
    );
  },

  createStudent: (payload: {
    fullName: string;
    email: string;
    username?: string;
    schoolName?: string;
    classroomId?: string;
    password?: string;
  }) =>
    requestJson<{ student: UserProfile }>('/api/users/students', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateStudent: (
    studentId: string,
    payload: {
      fullName?: string;
      username?: string;
      schoolName?: string;
      className?: string;
      bio?: string;
      isLocked?: boolean;
      newPassword?: string;
    }
  ) =>
    requestJson<{ student: UserProfile }>(
      `/api/users/students/${encodeURIComponent(studentId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    ),

  transferStudentClassroom: (
    studentId: string,
    payload: { fromClassroomId?: string | null; toClassroomId: string }
  ) =>
    requestJson<{ success: boolean; targetClassroom: Classroom }>(
      `/api/users/students/${encodeURIComponent(studentId)}/transfer-class`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  getStudentAchievements: (studentId: string) =>
    requestJson<{ achievement: StudentAchievementDetail }>(
      `/api/users/students/${encodeURIComponent(studentId)}/achievements`
    ),

  bulkImportStudents: (rows: StudentImportRowInput[]) =>
    requestJson<{ result: StudentImportResult }>('/api/users/students/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    }),

  // Classrooms
  listClassrooms: () => requestJson<{ classrooms: Classroom[] }>('/api/classrooms'),

  createClassroom: (payload: {
    name: string;
    subject: string;
    gradeLevel: string;
    description: string;
    customCode?: string;
  }) =>
    requestJson<{ classroom: Classroom }>('/api/classrooms', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateClassroom: (
    classroomId: string,
    payload: {
      name?: string;
      subject?: string;
      gradeLevel?: string;
      description?: string;
      isLocked?: boolean;
      regenerateCode?: boolean;
    }
  ) =>
    requestJson<{ classroom: Classroom }>(
      `/api/classrooms/${encodeURIComponent(classroomId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    ),

  addStudentToClassroom: (classroomId: string, identifier: string) =>
    requestJson<{ classroom: Classroom; members: ClassroomMember[] }>(
      `/api/classrooms/${encodeURIComponent(classroomId)}/add-student`,
      {
        method: 'POST',
        body: JSON.stringify({ identifier }),
      }
    ),

  joinClassroom: (code: string) =>
    requestJson<{ classroom: Classroom }>('/api/classrooms/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  getClassroomMembers: (classroomId: string) =>
    requestJson<{ classroom: Classroom; members: ClassroomMember[] }>(
      `/api/classrooms/${encodeURIComponent(classroomId)}/members`
    ),

  removeClassroomMember: (classroomId: string, studentId: string) =>
    requestJson<{ members: ClassroomMember[] }>(
      `/api/classrooms/${encodeURIComponent(classroomId)}/members/${encodeURIComponent(studentId)}`,
      { method: 'DELETE' }
    ),

  // Question Bank, Multi-Level Categories, Matrix Builder, Import/Export & AI Assistant
  listCategories: () => requestJson<{ categories: QuestionCategory[] }>('/api/question-categories'),

  createCategory: (payload: {
    name: string;
    educationLevel: string;
    gradeLevel: string;
    subject: string;
    topic: string;
    lesson?: string;
    description?: string;
  }) =>
    requestJson<{ category: QuestionCategory }>('/api/question-categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteCategory: (id: string) =>
    requestJson<{ deleted: boolean }>(`/api/question-categories/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  listQuestionSets: () => requestJson<{ questionSets: QuestionSet[] }>('/api/question-sets'),

  createQuestionSet: (payload: {
    title: string;
    subject: string;
    gradeLevel: string;
    educationLevel?: string;
    topic?: string;
    description: string;
    isPublic: boolean;
    defaultTimeLimitSec?: number;
    defaultPoints?: number;
    sharedWithIds?: string[];
  }) =>
    requestJson<{ questionSet: QuestionSet }>('/api/question-sets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateQuestionSet: (
    id: string,
    payload: {
      title?: string;
      subject?: string;
      gradeLevel?: string;
      educationLevel?: string;
      topic?: string;
      description?: string;
      isPublic?: boolean;
      defaultTimeLimitSec?: number;
      defaultPoints?: number;
      sharedWithIds?: string[];
    }
  ) =>
    requestJson<{ questionSet: QuestionSet }>(`/api/question-sets/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  duplicateQuestionSet: (id: string, newTitle?: string) =>
    requestJson<{ questionSet: QuestionSet }>(
      `/api/question-sets/${encodeURIComponent(id)}/duplicate`,
      {
        method: 'POST',
        body: JSON.stringify({ newTitle }),
      }
    ),

  reorderQuestionsInSet: (setId: string, orderedQuestionIds: string[]) =>
    requestJson<{ questions: FullQuestion[] }>(
      `/api/question-sets/${encodeURIComponent(setId)}/reorder`,
      {
        method: 'PUT',
        body: JSON.stringify({ orderedQuestionIds }),
      }
    ),

  removeQuestionFromSet: (setId: string, questionId: string) =>
    requestJson<{ removedFromSet: boolean; preservedInBank: boolean }>(
      `/api/question-sets/${encodeURIComponent(setId)}/questions/${encodeURIComponent(questionId)}`,
      {
        method: 'DELETE',
      }
    ),

  assignQuestionsToSet: (setId: string, questionIds: string[], copyAsNew = true) =>
    requestJson<{ addedCount: number; questions: FullQuestion[] }>(
      `/api/question-sets/${encodeURIComponent(setId)}/assign-questions`,
      {
        method: 'POST',
        body: JSON.stringify({ questionIds, copyAsNew }),
      }
    ),

  autoSelectMatrixForSet: (
    setId: string,
    payload: {
      subject?: string;
      gradeLevel?: string;
      topic?: string;
      arenaOnly?: boolean;
      cognitiveCounts?: Partial<Record<CognitiveLevel, number>>;
      difficultyCounts?: Partial<Record<DifficultyLevel, number>>;
      applyToSet?: boolean;
    }
  ) =>
    requestJson<{
      previewQuestions: FullQuestion[];
      totalSelected: number;
      applied: boolean;
      addedCount: number;
    }>(`/api/question-sets/${encodeURIComponent(setId)}/auto-matrix`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteQuestionSet: (id: string) =>
    requestJson<{ deleted: boolean }>(`/api/question-sets/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  listAllQuestions: (filters?: {
    questionSetId?: string;
    subject?: string;
    gradeLevel?: string;
    educationLevel?: string;
    topic?: string;
    questionType?: string;
    cognitiveLevel?: string;
    difficulty?: string;
    usageStatus?: string;
    search?: string;
  }) => {
    const q = new URLSearchParams();
    if (filters?.questionSetId) q.set('questionSetId', filters.questionSetId);
    if (filters?.subject) q.set('subject', filters.subject);
    if (filters?.gradeLevel) q.set('gradeLevel', filters.gradeLevel);
    if (filters?.educationLevel) q.set('educationLevel', filters.educationLevel);
    if (filters?.topic) q.set('topic', filters.topic);
    if (filters?.questionType) q.set('questionType', filters.questionType);
    if (filters?.cognitiveLevel) q.set('cognitiveLevel', filters.cognitiveLevel);
    if (filters?.difficulty) q.set('difficulty', filters.difficulty);
    if (filters?.usageStatus) q.set('usageStatus', filters.usageStatus);
    if (filters?.search) q.set('search', filters.search);
    return requestJson<{ questions: FullQuestion[] }>(`/api/questions?${q.toString()}`);
  },

  getQuestionsForSet: (id: string) =>
    requestJson<{
      questionSet: QuestionSet;
      questions: Array<FullQuestion | PublicQuestion>;
      answersMasked: boolean;
    }>(`/api/question-sets/${encodeURIComponent(id)}/questions`),

  addQuestionToSet: (
    setId: string,
    payload: {
      questionType?: QuestionType;
      prompt: string;
      imageUrl?: string;
      audioUrl?: string;
      videoUrl?: string;
      options: string[];
      correctIndex: number;
      correctIndices?: number[];
      correctAnswerText?: string;
      matchingPairs?: MatchingPairItem[];
      orderingItems?: string[];
      educationLevel?: string;
      gradeLevel?: string;
      subject?: string;
      topic?: string;
      lesson?: string;
      cognitiveLevel?: CognitiveLevel;
      difficulty?: DifficultyLevel;
      timeLimitSec: number;
      points: number;
      explanation: string;
      usageStatus?: QuestionUsageStatus;
    }
  ) =>
    requestJson<{ question: FullQuestion }>(
      `/api/question-sets/${encodeURIComponent(setId)}/questions`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  updateQuestion: (
    questionId: string,
    payload: {
      questionSetId?: string;
      questionType?: QuestionType;
      prompt?: string;
      imageUrl?: string;
      audioUrl?: string;
      videoUrl?: string;
      options?: string[];
      correctIndex?: number;
      correctIndices?: number[];
      correctAnswerText?: string;
      matchingPairs?: MatchingPairItem[];
      orderingItems?: string[];
      educationLevel?: string;
      gradeLevel?: string;
      subject?: string;
      topic?: string;
      lesson?: string;
      cognitiveLevel?: CognitiveLevel;
      difficulty?: DifficultyLevel;
      timeLimitSec?: number;
      points?: number;
      explanation?: string;
      usageStatus?: QuestionUsageStatus;
    }
  ) =>
    requestJson<{ question: FullQuestion }>(`/api/questions/${encodeURIComponent(questionId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  duplicateQuestion: (questionId: string, targetSetId?: string) =>
    requestJson<{ question: FullQuestion }>(
      `/api/questions/${encodeURIComponent(questionId)}/duplicate`,
      {
        method: 'POST',
        body: JSON.stringify({ targetSetId }),
      }
    ),

  deleteQuestion: (questionId: string) =>
    requestJson<{ deleted: boolean }>(`/api/questions/${encodeURIComponent(questionId)}`, {
      method: 'DELETE',
    }),

  getImportTemplate: (format: 'XLSX' | 'CSV' = 'XLSX') =>
    requestJson<{ fileName: string; mimeType: string; contentBase64: string }>(
      `/api/questions/import/template?format=${format}`
    ),

  previewQuestionsImport: (payload: {
    fileName: string;
    fileBase64: string;
    questionSetId?: string;
    defaultSubject?: string;
    defaultGradeLevel?: string;
    columnMapping?: Record<string, string>;
  }) =>
    requestJson<{
      preview: {
        fileName: string;
        format: 'XLSX' | 'CSV' | 'DOCX';
        totalRows: number;
        validCount: number;
        errorCount: number;
        duplicateCount: number;
        detectedColumns: string[];
        rows: any[];
      };
    }>('/api/questions/import/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  commitQuestionsImport: (payload: {
    questionSetId: string;
    rows: any[];
    skipDuplicates?: boolean;
    skipInvalid?: boolean;
  }) =>
    requestJson<{
      importedCount: number;
      skippedInvalidCount: number;
      skippedDuplicateCount: number;
      questions: FullQuestion[];
    }>('/api/questions/import/commit', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  exportQuestions: (payload: {
    questionSetId?: string;
    questionIds?: string[];
    format: 'XLSX' | 'CSV' | 'DOCX' | 'JSON';
    includeAnswers: boolean;
  }) =>
    requestJson<{
      exportResult: {
        fileName: string;
        mimeType: string;
        format: 'XLSX' | 'CSV' | 'DOCX' | 'JSON';
        includeAnswers: boolean;
        questionCount: number;
        contentBase64?: string;
        contentText?: string;
      };
    }>('/api/questions/export', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  runQualityCheck: (questionSetId?: string) => {
    const q = questionSetId ? `?questionSetId=${encodeURIComponent(questionSetId)}` : '';
    return requestJson<{
      totalIssues: number;
      errorCount: number;
      warningCount: number;
      issues: QuestionQualityIssue[];
    }>(`/api/questions/quality-check${q}`);
  },

  getAiStatus: () => requestJson<{ status: AiProviderStatus }>('/api/ai/status'),

  generateQuestionsByPrompt: (payload: {
    subject: string;
    gradeLevel: string;
    educationLevel?: string;
    topic: string;
    lesson?: string;
    questionType?: QuestionType;
    cognitiveLevel?: CognitiveLevel;
    difficulty?: DifficultyLevel;
    count: number;
    additionalInstructions?: string;
  }) =>
    requestJson<{
      questions: GeneratedDraftQuestion[];
      summary: string;
      usedFallback: boolean;
    }>('/api/ai/generate-prompt', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  generateQuestionsFromDocument: (payload: {
    fileName?: string;
    fileType?: 'DOCX' | 'TXT' | 'CSV' | 'RAW_TEXT';
    fileBase64?: string;
    rawText?: string;
    subject: string;
    gradeLevel: string;
    topic?: string;
    questionType?: QuestionType;
    cognitiveLevel?: CognitiveLevel;
    difficulty?: DifficultyLevel;
    count: number;
  }) =>
    requestJson<{
      questions: GeneratedDraftQuestion[];
      extractedKeyPoints: string[];
      documentLength: number;
      usedFallback: boolean;
      warning?: string;
    }>('/api/ai/generate-document', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  generateQuestionsFromImage: (payload: {
    mimeType: string;
    imageBase64: string;
    subject: string;
    gradeLevel: string;
    topic?: string;
    count: number;
    teacherPrompt?: string;
  }) =>
    requestJson<{
      questions: GeneratedDraftQuestion[];
      imageAnalysisSummary: string;
      usedFallback: boolean;
    }>('/api/ai/generate-image', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Rooms & Game Engine
  listActiveRooms: () =>
    requestJson<{
      rooms: Array<{
        id: string;
        code: string;
        title: string;
        description?: string;
        questionSetTitle: string;
        hostName: string;
        status: RoomStatus;
        gameMode?: GameMode;
        accessPolicy?: RoomAccessPolicy;
        isPublic?: boolean;
        isJoinLocked?: boolean;
        participantCount: number;
        maxParticipants?: number;
        isTestMode: boolean;
      }>;
    }>('/api/rooms/active'),

  createRoom: (payload: {
    questionSetId?: string;
    title?: string;
    description?: string;
    classroomId?: string | null;
    questionLimit?: number;
    timeLimitOverrideSec?: number | null;
    pointsOverride?: number | null;
    gameMode?: GameMode;
    maxParticipants?: number;
    accessPolicy?: RoomAccessPolicy;
    isPublic?: boolean;
    isTestMode?: boolean;
    isTeamMode?: boolean;
    teamCount?: number;
    teamPlayFormat?: TeamPlayFormat;
    customTeams?: Array<{ name: string; colorHex: string; colorName: string }>;
    revealAnswersPolicy?: 'IMMEDIATE' | 'END_OF_MATCH';
    publicLeaderboardPolicy?: boolean;
    allowRejoinPolicy?: boolean;
    maxAttemptsPerPlayer?: number;
  }) =>
    requestJson<{ room: LiveRoomState }>('/api/rooms', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  configureRoomTeams: (
    code: string,
    payload: {
      action:
        | 'CREATE_TEAM'
        | 'RENAME_TEAM'
        | 'ASSIGN_MEMBER'
        | 'AUTO_ASSIGN'
        | 'SET_CAPTAIN'
        | 'SET_FORMAT';
      teamId?: string;
      teamName?: string;
      colorHex?: string;
      colorName?: string;
      targetUserId?: string;
      teamPlayFormat?: TeamPlayFormat;
    }
  ) =>
    requestJson<{ room: LiveRoomState }>(`/api/rooms/${encodeURIComponent(code)}/teams`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  joinRoom: (code: string, displayName?: string) =>
    requestJson<{ room: LiveRoomState }>('/api/rooms/join', {
      method: 'POST',
      body: JSON.stringify({ code, displayName }),
    }),

  leaveRoom: (code: string) =>
    requestJson<{ room: LiveRoomState }>(`/api/rooms/${encodeURIComponent(code)}/leave`, {
      method: 'POST',
    }),

  getRoomState: (code: string) =>
    requestJson<{ room: LiveRoomState }>(`/api/rooms/${encodeURIComponent(code)}`),

  advanceRoom: (code: string) =>
    requestJson<{ room: LiveRoomState }>(`/api/rooms/${encodeURIComponent(code)}/next`, {
      method: 'POST',
    }),

  revealRoomQuestion: (code: string) =>
    requestJson<{ room: LiveRoomState }>(`/api/rooms/${encodeURIComponent(code)}/reveal`, {
      method: 'POST',
    }),

  pauseRoom: (code: string) =>
    requestJson<{ room: LiveRoomState }>(`/api/rooms/${encodeURIComponent(code)}/pause`, {
      method: 'POST',
    }),

  resumeRoom: (code: string) =>
    requestJson<{ room: LiveRoomState }>(`/api/rooms/${encodeURIComponent(code)}/resume`, {
      method: 'POST',
    }),

  endRoom: (code: string) =>
    requestJson<{ room: LiveRoomState }>(`/api/rooms/${encodeURIComponent(code)}/end`, {
      method: 'POST',
    }),

  toggleRoomLock: (code: string, isJoinLocked?: boolean) =>
    requestJson<{ room: LiveRoomState }>(`/api/rooms/${encodeURIComponent(code)}/lock`, {
      method: 'POST',
      body: JSON.stringify({ isJoinLocked }),
    }),

  submitRoomAnswer: (
    code: string,
    selectedIndexOrPayload:
      | number
      | {
          selectedIndex?: number;
          selectedIndices?: number[];
          questionId?: string;
          sessionId?: string;
        }
  ) => {
    const bodyPayload =
      typeof selectedIndexOrPayload === 'number'
        ? { selectedIndex: selectedIndexOrPayload, clientSubmittedAt: Date.now() }
        : { ...selectedIndexOrPayload, clientSubmittedAt: Date.now() };
    return requestJson<{ room: LiveRoomState }>(`/api/rooms/${encodeURIComponent(code)}/answer`, {
      method: 'POST',
      body: JSON.stringify(bodyPayload),
    });
  },

  // Leaderboard, History & Role Dashboards
  getRoleDashboardSummary: () =>
    requestJson<{ summary: RoleDashboardSummary }>('/api/dashboard/role-summary'),

  getLeaderboard: (limit = 30) =>
    requestJson<{ leaderboard: LeaderboardEntry[] }>(`/api/leaderboard?limit=${limit}`),

  getHistory: (page = 1, limit = 30) =>
    requestJson<{ history: MatchHistoryRecord[]; pagination?: PaginationMetadata }>(
      `/api/history?page=${page}&limit=${limit}`
    ),

  getMatchSubmissions: (matchId: string) =>
    requestJson<{ submissions: MatchSubmissionDetail[] }>(
      `/api/history/${encodeURIComponent(matchId)}/submissions`
    ),

  getReportSummary: () => requestJson<{ summary: ReportSummary }>('/api/reports/summary'),

  // Admin & Teacher Management
  listAdminUsers: (
    page = 1,
    limit = 50,
    filters?: { role?: UserRole; search?: string; status?: 'ALL' | 'ACTIVE' | 'LOCKED' }
  ) => {
    const q = new URLSearchParams();
    q.set('page', String(page));
    q.set('limit', String(limit));
    if (filters?.role) q.set('role', filters.role);
    if (filters?.search) q.set('search', filters.search);
    if (filters?.status) q.set('status', filters.status);
    return requestJson<{ users: UserProfile[]; pagination: PaginationMetadata }>(
      `/api/admin/users?${q.toString()}`
    );
  },

  adminCreateUser: (payload: {
    email: string;
    username?: string;
    fullName: string;
    password: string;
    role: UserRole;
    schoolName?: string;
    className?: string;
    bio?: string;
  }) =>
    requestJson<{ user: UserProfile }>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  adminEditUser: (
    userId: string,
    payload: {
      fullName?: string;
      username?: string;
      email?: string;
      schoolName?: string;
      className?: string;
      bio?: string;
      role?: UserRole;
      isLocked?: boolean;
      newPassword?: string;
    }
  ) =>
    requestJson<{ user: UserProfile }>(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  getTeacherDetails: (teacherId: string) =>
    requestJson<{ details: TeacherDetailStats }>(
      `/api/admin/teachers/${encodeURIComponent(teacherId)}/details`
    ),

  listAdminRoles: () => requestJson<{ roles: RoleEntity[] }>('/api/admin/roles'),

  listActivityLogs: (page = 1, limit = 20) =>
    requestJson<{ logs: ActivityLogRecord[]; pagination: PaginationMetadata }>(
      `/api/admin/activity-logs?page=${page}&limit=${limit}`
    ),

  updateAdminUser: (userId: string, payload: { role: UserRole; isLocked: boolean }) =>
    requestJson<{ user: UserProfile }>(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getSystemDiagnostics: () =>
    requestJson<{ diagnostics: SystemArchitectureDiagnostics }>('/api/system/diagnostics'),

  // ==========================================================================
  // PROMPT 5: GAME MODES & GAMIFICATION ENDPOINTS
  // ==========================================================================
  getGameCenterHub: () =>
    requestJson<{
      modes: GameModeCardInfo[];
      xpProfile: XpProfileSummary;
      badges: BadgeDefinitionRecord[];
      missions: LearningMissionRecord[];
      dailyChallenge: DailyChallengeInfo;
      bookmarks: BookmarkedQuestionRecord[];
      classAssignments: ClassAssignmentRecord[];
      tournaments: TournamentRecord[];
    }>('/api/gamification/hub'),

  getXpProfile: (userId?: string) => {
    const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return requestJson<{
      xpProfile: XpProfileSummary;
      badges: BadgeDefinitionRecord[];
      missions: LearningMissionRecord[];
    }>(`/api/gamification/xp-profile${q}`);
  },

  adminUpdateBadge: (
    badgeCode: string,
    payload: {
      name?: string;
      description?: string;
      conditionValue?: number;
      xpBonus?: number;
    }
  ) =>
    requestJson<{ badge: BadgeDefinitionRecord }>(
      `/api/gamification/badges/${encodeURIComponent(badgeCode)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    ),

  claimMissionReward: (missionCode: string) =>
    requestJson<{
      mission: LearningMissionRecord;
      xpProfile: XpProfileSummary;
    }>(`/api/gamification/missions/${encodeURIComponent(missionCode)}/claim`, {
      method: 'POST',
    }),

  toggleBookmarkQuestion: (questionId: string, note?: string) =>
    requestJson<{
      bookmarked: boolean;
      bookmarks: BookmarkedQuestionRecord[];
    }>('/api/gamification/bookmarks', {
      method: 'POST',
      body: JSON.stringify({ questionId, note }),
    }),

  startInteractiveSession: (payload: {
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
  }) =>
    requestJson<{ session: SoloOrPracticeSessionPayload }>('/api/gamification/sessions/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  checkPracticeAnswerImmediate: (
    sessionId: string,
    questionId: string,
    selectedIndex: number
  ) =>
    requestJson<{
      questionId: string;
      isCorrect: boolean;
      correctIndex: number;
      explanation: string;
    }>(`/api/gamification/sessions/${encodeURIComponent(sessionId)}/check`, {
      method: 'POST',
      body: JSON.stringify({ questionId, selectedIndex }),
    }),

  submitInteractiveSession: (
    sessionId: string,
    answers: Array<{
      questionId: string;
      selectedIndex: number | null;
      selectedIndices?: number[];
      responseTimeMs: number;
    }>
  ) =>
    requestJson<{ result: SoloOrPracticeResultSummary }>(
      `/api/gamification/sessions/${encodeURIComponent(sessionId)}/submit`,
      {
        method: 'POST',
        body: JSON.stringify({ answers }),
      }
    ),

  createClassAssignment: (payload: {
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
  }) =>
    requestJson<{ assignment: ClassAssignmentRecord }>('/api/gamification/class-assignments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getClassAssignmentStandings: (assignmentId: string) =>
    requestJson<{ standings: ClassAssignmentSubmissionRecord[] }>(
      `/api/gamification/class-assignments/${encodeURIComponent(assignmentId)}/standings`
    ),

  toggleClassAssignmentPublish: (assignmentId: string, isPublishedResults: boolean) =>
    requestJson<{ assignment: ClassAssignmentRecord }>(
      `/api/gamification/class-assignments/${encodeURIComponent(assignmentId)}/publish`,
      {
        method: 'PATCH',
        body: JSON.stringify({ isPublishedResults }),
      }
    ),

  createTournament: (payload: {
    title: string;
    description?: string;
    classroomId?: string | null;
    roundQuestionSetIds?: string[];
    qualifyRound1?: number;
    qualifyRound2?: number;
  }) =>
    requestJson<{ tournament: TournamentRecord }>('/api/gamification/tournaments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  advanceTournamentRound: (tournamentId: string) =>
    requestJson<{ tournament: TournamentRecord }>(
      `/api/gamification/tournaments/${encodeURIComponent(tournamentId)}/advance`,
      {
        method: 'POST',
      }
    ),

  getMultiDimensionalLeaderboard: (filters?: {
    boardType?: 'OVERALL' | 'MATCH' | 'CLASS' | 'SUBJECT' | 'WEEKLY' | 'MONTHLY' | 'SEASON';
    metric?: 'MATCH_SCORE' | 'XP' | 'ACHIEVEMENT_POINTS' | 'TOURNAMENT_POINTS';
    classroomId?: string;
    subject?: string;
    gradeLevel?: string;
    anonymize?: boolean;
  }) => {
    const q = new URLSearchParams();
    if (filters?.boardType) q.set('boardType', filters.boardType);
    if (filters?.metric) q.set('metric', filters.metric);
    if (filters?.classroomId) q.set('classroomId', filters.classroomId);
    if (filters?.subject) q.set('subject', filters.subject);
    if (filters?.gradeLevel) q.set('gradeLevel', filters.gradeLevel);
    if (filters?.anonymize) q.set('anonymize', 'true');
    return requestJson<{
      boardType: string;
      metric: string;
      metricLabel: string;
      entries: Array<{
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
      }>;
    }>(`/api/gamification/leaderboards?${q.toString()}`);
  },
};

export const apiClient = api;

export interface RoomWebSocketController {
  close: () => void;
}

export function createRoomWebSocket(
  roomCode: string,
  onState: (room: LiveRoomState) => void,
  onError?: (errMessage: string) => void
): RoomWebSocketController | null {
  if (!inMemoryAuthToken) return null;

  let ws: WebSocket | null = null;
  let closedManually = false;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;

  const connect = () => {
    if (closedManually || !inMemoryAuthToken) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(
      inMemoryAuthToken
    )}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      reconnectAttempt = 0;
      ws?.send(JSON.stringify({ type: 'room:subscribe', roomCode }));

      if (pingTimer) clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 20000);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data));
        if (msg.type === 'room:state' && msg.room) {
          onState(msg.room as LiveRoomState);
        } else if (msg.type === 'room:error' && msg.error && onError) {
          onError(String(msg.error));
        }
      } catch {
        // ignore malformed frame
      }
    };

    ws.onclose = () => {
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
      if (!closedManually) {
        const delayMs = Math.min(5000, 1000 * Math.pow(1.5, reconnectAttempt));
        reconnectAttempt += 1;
        reconnectTimer = setTimeout(connect, delayMs);
      }
    };
  };

  connect();

  return {
    close: () => {
      closedManually = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      if (ws) ws.close();
    },
  };
}
