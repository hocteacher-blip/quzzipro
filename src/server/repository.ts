import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import type {
  ActivityLogRecord,
  Classroom,
  ClassroomMember,
  CognitiveLevel,
  DifficultyLevel,
  FullQuestion,
  LeaderboardEntry,
  MatchHistoryRecord,
  MatchSubmissionDetail,
  MatchingPairItem,
  PaginationMetadata,
  QuestionCategory,
  QuestionQualityIssue,
  QuestionSet,
  QuestionType,
  QuestionUsageStatus,
  ReportSummary,
  RoleDashboardSummary,
  RoleEntity,
  RoomStatus,
  StudentAchievementDetail,
  StudentImportResult,
  StudentImportRowInput,
  TeacherDetailStats,
  UserProfile,
  UserRole,
} from '../types/arena.ts';

export interface StoredUserRecord extends UserProfile {
  passwordHash: string;
}

export interface PersistedMatchParticipant {
  userId: string;
  displayName: string;
  role: UserRole;
  score: number;
  correctCount: number;
  maxStreak?: number;
}

export interface PersistedSubmission {
  userId: string;
  questionId: string;
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

export interface IDataRepository {
  getEngineName(): string;
  isAdminInitialized(): boolean;

  // Roles Module
  listRoles(): RoleEntity[];

  // Users & Authentication Module
  getUserById(id: string): UserProfile | null;
  getStoredUserById(id: string): StoredUserRecord | null;
  getStoredUserByEmail(email: string): StoredUserRecord | null;
  getStoredUserByUsername(username: string): StoredUserRecord | null;
  createUser(params: {
    email: string;
    username?: string;
    fullName: string;
    passwordHash: string;
    role: UserRole;
    schoolName?: string;
    className?: string;
    avatarUrl?: string;
    bio?: string;
  }): UserProfile;
  updateUserProfile(
    userId: string,
    updates: {
      fullName: string;
      username?: string;
      avatarUrl?: string;
      schoolName: string;
      className?: string;
      bio: string;
      passwordHash?: string;
    }
  ): UserProfile | null;
  updateUserPassword(userId: string, passwordHash: string): boolean;
  createPasswordResetToken(email: string): { resetCode: string; expiresAt: string; user: UserProfile } | null;
  consumePasswordResetToken(email: string, resetCode: string, newPasswordHash: string): UserProfile | null;

  listAllUsers(
    page?: number,
    limit?: number,
    filters?: { role?: UserRole; search?: string; status?: 'ALL' | 'ACTIVE' | 'LOCKED' }
  ): {
    users: UserProfile[];
    pagination: PaginationMetadata;
  };
  adminUpdateUser(
    userId: string,
    updates: {
      fullName?: string;
      username?: string;
      email?: string;
      schoolName?: string;
      className?: string;
      bio?: string;
      role?: UserRole;
      isLocked?: boolean;
      passwordHash?: string;
    }
  ): UserProfile | null;
  updateUserRoleOrLock(userId: string, role: UserRole, isLocked: boolean): UserProfile | null;
  getTeacherDetailStats(teacherId: string): TeacherDetailStats | null;

  // Student Management & CSV Import
  listStudentsForActor(
    actor: UserProfile,
    options?: {
      search?: string;
      classroomId?: string;
      status?: 'ALL' | 'ACTIVE' | 'LOCKED';
      page?: number;
      limit?: number;
    }
  ): {
    students: UserProfile[];
    pagination: PaginationMetadata;
  };
  getStudentAchievementDetail(studentId: string): StudentAchievementDetail | null;
  transferStudentClassroom(
    studentId: string,
    fromClassroomId: string | null,
    toClassroomId: string
  ): boolean;
  bulkImportStudents(
    rows: StudentImportRowInput[],
    defaultPasswordHashFn: (rawPass: string) => string
  ): StudentImportResult;

  // Classes & ClassMember Module
  listClassrooms(user: UserProfile): Classroom[];
  getClassroomByCode(code: string): Classroom | null;
  getClassroomById(id: string): Classroom | null;
  createClassroom(params: {
    name: string;
    subject: string;
    gradeLevel: string;
    description: string;
    teacherId: string;
    customCode?: string;
  }): Classroom;
  updateClassroom(
    classroomId: string,
    updates: {
      name?: string;
      subject?: string;
      gradeLevel?: string;
      description?: string;
      isLocked?: boolean;
      regenerateCode?: boolean;
    }
  ): Classroom | null;
  isStudentInClassroom(classroomId: string, studentId: string): boolean;
  joinClassroom(classroomId: string, studentId: string): boolean;
  removeStudentFromClassroom(classroomId: string, studentId: string): boolean;
  listClassroomMembers(classroomId: string): ClassroomMember[];

  // Questions, QuestionOption, Quiz, QuizQuestion & Categories Modules (Smart Question Bank)
  listCategories(): QuestionCategory[];
  createCategory(params: {
    educationLevel: string;
    gradeLevel: string;
    subject: string;
    topic: string;
    lesson: string;
    creatorId: string;
  }): QuestionCategory;
  deleteCategory(id: string): boolean;

  listQuestionSets(user?: UserProfile): QuestionSet[];
  getQuestionSetById(id: string): QuestionSet | null;
  createQuestionSet(params: {
    title: string;
    subject: string;
    gradeLevel: string;
    topic?: string;
    description: string;
    creatorId: string;
    isPublic: boolean;
    sharedWithIds?: string[];
    defaultPoints?: number;
    defaultTimeLimitSec?: number;
  }): QuestionSet;
  updateQuestionSet(
    id: string,
    updates: {
      title?: string;
      subject?: string;
      gradeLevel?: string;
      topic?: string;
      description?: string;
      isPublic?: boolean;
      sharedWithIds?: string[];
      defaultPoints?: number;
      defaultTimeLimitSec?: number;
    }
  ): QuestionSet | null;
  duplicateQuestionSet(id: string, actor: UserProfile): QuestionSet | null;
  deleteQuestionSet(id: string): boolean;

  getQuestionsForSet(questionSetId: string): FullQuestion[];
  getQuestionById(questionId: string): FullQuestion | null;
  listAllQuestions(filters?: {
    search?: string;
    questionSetId?: string;
    educationLevel?: string;
    gradeLevel?: string;
    subject?: string;
    topic?: string;
    lesson?: string;
    questionType?: QuestionType;
    cognitiveLevel?: CognitiveLevel;
    difficulty?: DifficultyLevel;
    usageStatus?: QuestionUsageStatus;
    creatorId?: string;
    arenaOnly?: boolean;
  }): FullQuestion[];

  addQuestionToSet(params: {
    questionSetId: string;
    questionCode?: string;
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
    timeLimitSec: number;
    points: number;
    explanation: string;
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
  }): FullQuestion;

  updateQuestion(
    questionId: string,
    updates: {
      questionType?: QuestionType;
      prompt?: string;
      imageUrl?: string | null;
      audioUrl?: string | null;
      videoUrl?: string | null;
      options?: string[];
      correctIndex?: number;
      correctIndices?: number[];
      correctAnswerText?: string;
      matchingPairs?: MatchingPairItem[];
      orderingItems?: string[];
      timeLimitSec?: number;
      points?: number;
      explanation?: string;
      educationLevel?: string;
      gradeLevel?: string;
      subject?: string;
      topic?: string;
      lesson?: string;
      cognitiveLevel?: CognitiveLevel;
      difficulty?: DifficultyLevel;
      usageStatus?: QuestionUsageStatus;
    }
  ): FullQuestion | null;

  duplicateQuestion(
    questionId: string,
    targetSetId: string,
    actor: UserProfile
  ): FullQuestion | null;

  reorderQuestionsInSet(questionSetId: string, orderedQuestionIds: string[]): FullQuestion[];
  removeQuestionFromSet(questionSetId: string, questionId: string): boolean;
  deleteQuestion(questionId: string): boolean;

  autoSelectQuestionsByMatrix(params: {
    subject?: string;
    gradeLevel?: string;
    topic?: string;
    arenaOnly?: boolean;
    matrix: {
      rememberCount?: number;
      understandCount?: number;
      applyCount?: number;
      highApplyCount?: number;
      easyCount?: number;
      mediumCount?: number;
      hardCount?: number;
      veryHardCount?: number;
    };
  }): FullQuestion[];

  analyzeQuestionBankQuality(params?: {
    questionSetId?: string;
    topic?: string;
  }): QuestionQualityIssue[];

  // Rooms, GameParticipant & GameSession Persistence + Snapshot Recovery
  upsertGameRoomRecord(params: {
    roomId: string;
    sessionId: string;
    code: string;
    title: string;
    quizId: string;
    classroomId: string | null;
    hostId: string;
    status: RoomStatus;
    maxParticipants: number;
    isTestMode: boolean;
    totalQuestions: number;
    snapshotJson?: string;
  }): void;
  loadRecoverableRoomSnapshots(): string[];
  upsertGameParticipantRecord(params: {
    roomId: string;
    userId: string;
    displayName: string;
    role: UserRole;
    isOnline: boolean;
  }): void;
  recordPlayerAnswer(params: {
    sessionId: string;
    roomId: string;
    userId: string;
    questionId: string;
    questionIndex: number;
    selectedIndex: number | null;
    isCorrect: boolean;
    earnedPoints: number;
    responseTimeMs: number;
  }): boolean;

  // Scoring, Leaderboard & Match History
  saveCompletedMatch(params: {
    roomId: string;
    sessionId?: string;
    roomCode: string;
    roomTitle: string;
    questionSetId: string;
    questionSetTitle: string;
    hostId: string;
    hostName: string;
    totalQuestions: number;
    participants: PersistedMatchParticipant[];
    submissions: PersistedSubmission[];
  }): void;
  listMatchHistory(userId?: string, page?: number, limit?: number): {
    history: MatchHistoryRecord[];
    pagination: PaginationMetadata;
  };
  getMatchSubmissionDetails(matchId: string, userId: string): MatchSubmissionDetail[];
  getLeaderboard(limit?: number): LeaderboardEntry[];

  // Reports, Role Dashboard & ActivityLog Modules
  getRoleDashboardSummary(user: UserProfile, activeLiveRoomsCount: number): RoleDashboardSummary;
  logActivity(params: {
    actorId: string;
    actorName: string;
    actorRole: UserRole;
    action: string;
    module: string;
    targetId?: string;
    details?: string;
  }): void;
  listActivityLogs(page?: number, limit?: number): {
    logs: ActivityLogRecord[];
    pagination: PaginationMetadata;
  };
  getReportSummary(): ReportSummary;
  getSystemCounts(): {
    totalUsers: number;
    totalQuestionSets: number;
    totalQuestions: number;
    totalMatchesCompleted: number;
    totalActivityLogs: number;
  };
}

export class SqliteDataRepository implements IDataRepository {
  private db: Database.Database;

  constructor(dbFilePath = path.resolve(process.cwd(), 'quizzi_arena.db')) {
    this.db = new Database(dbFilePath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('synchronous = NORMAL');
    this.initSchema();
    this.runIncrementalMigrations();
    this.seedInitialContentIfNeeded();
  }

  public getEngineName(): string {
    return 'SQLite 3 (WAL Mode, Normalized 15 Entities + Indexed) via IDataRepository';
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL CHECK(code IN ('ADMIN', 'TEACHER', 'STUDENT')),
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        permissions_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL DEFAULT '',
        email TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        avatar_url TEXT NOT NULL DEFAULT '',
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('ADMIN', 'TEACHER', 'STUDENT')),
        school_name TEXT NOT NULL DEFAULT '',
        class_name TEXT NOT NULL DEFAULT '',
        bio TEXT NOT NULL DEFAULT '',
        is_locked INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS classrooms (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        grade_level TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        teacher_id TEXT NOT NULL,
        is_locked INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_classrooms_teacher ON classrooms(teacher_id);
      CREATE INDEX IF NOT EXISTS idx_classrooms_code ON classrooms(code);

      CREATE TABLE IF NOT EXISTS classroom_members (
        id TEXT PRIMARY KEY,
        classroom_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        joined_at TEXT NOT NULL,
        UNIQUE(classroom_id, student_id),
        FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_class_members_class ON classroom_members(classroom_id);
      CREATE INDEX IF NOT EXISTS idx_class_members_student ON classroom_members(student_id);

      CREATE TABLE IF NOT EXISTS question_sets (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        subject TEXT NOT NULL,
        grade_level TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        creator_id TEXT NOT NULL,
        is_public INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_question_sets_subject ON question_sets(subject);

      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        question_set_id TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        prompt TEXT NOT NULL,
        options_json TEXT NOT NULL,
        correct_index INTEGER NOT NULL CHECK(correct_index >= 0 AND correct_index <= 3),
        time_limit_sec INTEGER NOT NULL DEFAULT 20 CHECK(time_limit_sec >= 5 AND time_limit_sec <= 300),
        points INTEGER NOT NULL DEFAULT 1000 CHECK(points >= 50 AND points <= 10000),
        explanation TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (question_set_id) REFERENCES question_sets(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_questions_set_order ON questions(question_set_id, order_index);

      CREATE TABLE IF NOT EXISTS question_options (
        id TEXT PRIMARY KEY,
        question_id TEXT NOT NULL,
        option_index INTEGER NOT NULL CHECK(option_index >= 0 AND option_index <= 3),
        option_text TEXT NOT NULL,
        is_correct INTEGER NOT NULL DEFAULT 0,
        UNIQUE(question_id, option_index),
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_question_options_qid ON question_options(question_id);

      CREATE TABLE IF NOT EXISTS quiz_questions (
        id TEXT PRIMARY KEY,
        quiz_id TEXT NOT NULL,
        question_id TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        points_override INTEGER,
        time_limit_override INTEGER,
        UNIQUE(quiz_id, question_id),
        FOREIGN KEY (quiz_id) REFERENCES question_sets(id) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions(quiz_id, order_index);

      CREATE TABLE IF NOT EXISTS game_rooms (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        title TEXT NOT NULL,
        quiz_id TEXT NOT NULL,
        classroom_id TEXT,
        host_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('LOBBY', 'QUESTION_ACTIVE', 'QUESTION_REVEAL', 'FINISHED')),
        max_participants INTEGER NOT NULL DEFAULT 100,
        is_test_mode INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_game_rooms_code ON game_rooms(code);
      CREATE INDEX IF NOT EXISTS idx_game_rooms_status ON game_rooms(status);

      CREATE TABLE IF NOT EXISTS game_participants (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL,
        is_online INTEGER NOT NULL DEFAULT 1,
        joined_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        UNIQUE(room_id, user_id),
        FOREIGN KEY (room_id) REFERENCES game_rooms(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_game_participants_room ON game_participants(room_id);

      CREATE TABLE IF NOT EXISTS game_sessions (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        quiz_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        total_questions INTEGER NOT NULL,
        participant_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        FOREIGN KEY (room_id) REFERENCES game_rooms(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_game_sessions_room ON game_sessions(room_id);

      CREATE TABLE IF NOT EXISTS player_answers (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        question_id TEXT NOT NULL,
        question_index INTEGER NOT NULL,
        selected_option_index INTEGER,
        is_correct INTEGER NOT NULL DEFAULT 0,
        earned_points INTEGER NOT NULL DEFAULT 0,
        response_time_ms INTEGER NOT NULL DEFAULT 0,
        answered_at TEXT NOT NULL,
        UNIQUE(session_id, user_id, question_id)
      );
      CREATE INDEX IF NOT EXISTS idx_player_answers_session_user ON player_answers(session_id, user_id);

      CREATE TABLE IF NOT EXISTS scores (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        total_score INTEGER NOT NULL DEFAULT 0,
        correct_count INTEGER NOT NULL DEFAULT 0,
        max_streak INTEGER NOT NULL DEFAULT 0,
        accuracy_percent INTEGER NOT NULL DEFAULT 0,
        rank_position INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL,
        UNIQUE(session_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_scores_session_rank ON scores(session_id, rank_position);

      CREATE TABLE IF NOT EXISTS leaderboards (
        user_id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        school_name TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'STUDENT',
        total_score INTEGER NOT NULL DEFAULT 0,
        matches_played INTEGER NOT NULL DEFAULT 0,
        total_correct INTEGER NOT NULL DEFAULT 0,
        total_answered INTEGER NOT NULL DEFAULT 0,
        accuracy_percent INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_leaderboards_score ON leaderboards(total_score DESC);

      CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL,
        actor_name TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        action TEXT NOT NULL,
        module TEXT NOT NULL,
        target_id TEXT NOT NULL DEFAULT '',
        details TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);

      CREATE TABLE IF NOT EXISTS completed_matches (
        id TEXT PRIMARY KEY,
        room_code TEXT NOT NULL,
        room_title TEXT NOT NULL,
        question_set_id TEXT NOT NULL,
        question_set_title TEXT NOT NULL,
        host_id TEXT NOT NULL,
        host_name TEXT NOT NULL,
        total_questions INTEGER NOT NULL,
        participant_count INTEGER NOT NULL,
        finished_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS match_results (
        id TEXT PRIMARY KEY,
        match_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL,
        score INTEGER NOT NULL,
        correct_count INTEGER NOT NULL,
        rank_position INTEGER NOT NULL,
        FOREIGN KEY (match_id) REFERENCES completed_matches(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS match_submissions (
        id TEXT PRIMARY KEY,
        match_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        question_index INTEGER NOT NULL,
        prompt TEXT NOT NULL,
        options_json TEXT NOT NULL,
        selected_index INTEGER,
        correct_index INTEGER NOT NULL,
        is_correct INTEGER NOT NULL,
        earned_points INTEGER NOT NULL,
        response_time_ms INTEGER NOT NULL,
        explanation TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (match_id) REFERENCES completed_matches(id) ON DELETE CASCADE
      );
    `);
  }

  private runIncrementalMigrations(): void {
    const userCols = this.db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
    const hasCol = (col: string) => userCols.some((c) => c.name === col);
    if (!hasCol('username')) {
      this.db.exec("ALTER TABLE users ADD COLUMN username TEXT NOT NULL DEFAULT ''");
    }
    if (!hasCol('avatar_url')) {
      this.db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT ''");
    }
    if (!hasCol('class_name')) {
      this.db.exec("ALTER TABLE users ADD COLUMN class_name TEXT NOT NULL DEFAULT ''");
    }

    const classCols = this.db
      .prepare('PRAGMA table_info(classrooms)')
      .all() as Array<{ name: string }>;
    if (!classCols.some((c) => c.name === 'is_locked')) {
      this.db.exec('ALTER TABLE classrooms ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0');
    }

    const qCols = this.db
      .prepare('PRAGMA table_info(questions)')
      .all() as Array<{ name: string }>;
    const hasQCol = (col: string) => qCols.some((c) => c.name === col);
    if (!hasQCol('question_type')) {
      this.db.exec(
        "ALTER TABLE questions ADD COLUMN question_type TEXT NOT NULL DEFAULT 'SINGLE_CHOICE'"
      );
    }
    if (!hasQCol('correct_indices_json')) {
      this.db.exec("ALTER TABLE questions ADD COLUMN correct_indices_json TEXT NOT NULL DEFAULT '[]'");
    }
    if (!hasQCol('image_url')) {
      this.db.exec("ALTER TABLE questions ADD COLUMN image_url TEXT NOT NULL DEFAULT ''");
    }
    if (!hasQCol('audio_url')) {
      this.db.exec("ALTER TABLE questions ADD COLUMN audio_url TEXT NOT NULL DEFAULT ''");
    }
    if (!hasQCol('video_url')) {
      this.db.exec("ALTER TABLE questions ADD COLUMN video_url TEXT NOT NULL DEFAULT ''");
    }
    if (!hasQCol('question_code')) {
      this.db.exec("ALTER TABLE questions ADD COLUMN question_code TEXT NOT NULL DEFAULT ''");
    }
    if (!hasQCol('education_level')) {
      this.db.exec("ALTER TABLE questions ADD COLUMN education_level TEXT NOT NULL DEFAULT 'THPT'");
    }
    if (!hasQCol('grade_level')) {
      this.db.exec("ALTER TABLE questions ADD COLUMN grade_level TEXT NOT NULL DEFAULT 'Khối 12'");
    }
    if (!hasQCol('subject')) {
      this.db.exec("ALTER TABLE questions ADD COLUMN subject TEXT NOT NULL DEFAULT 'Tổng hợp'");
    }
    if (!hasQCol('topic')) {
      this.db.exec("ALTER TABLE questions ADD COLUMN topic TEXT NOT NULL DEFAULT 'Chuyên đề chung'");
    }
    if (!hasQCol('lesson')) {
      this.db.exec("ALTER TABLE questions ADD COLUMN lesson TEXT NOT NULL DEFAULT 'Bài học chuẩn'");
    }
    if (!hasQCol('cognitive_level')) {
      this.db.exec("ALTER TABLE questions ADD COLUMN cognitive_level TEXT NOT NULL DEFAULT 'UNDERSTAND'");
    }
    if (!hasQCol('difficulty')) {
      this.db.exec("ALTER TABLE questions ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'MEDIUM'");
    }
    if (!hasQCol('usage_status')) {
      this.db.exec("ALTER TABLE questions ADD COLUMN usage_status TEXT NOT NULL DEFAULT 'ACTIVE'");
    }
    if (!hasQCol('creator_id')) {
      this.db.exec("ALTER TABLE questions ADD COLUMN creator_id TEXT NOT NULL DEFAULT 'usr_teacher_demo'");
    }
    if (!hasQCol('creator_name')) {
      this.db.exec("ALTER TABLE questions ADD COLUMN creator_name TEXT NOT NULL DEFAULT 'ThS. Nguyễn Minh Hoàng'");
    }
    if (!hasQCol('created_at')) {
      this.db.exec("ALTER TABLE questions ADD COLUMN created_at TEXT NOT NULL DEFAULT ''");
    }
    if (!hasQCol('updated_at')) {
      this.db.exec("ALTER TABLE questions ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''");
    }
    if (!hasQCol('correct_answer_text')) {
      this.db.exec("ALTER TABLE questions ADD COLUMN correct_answer_text TEXT NOT NULL DEFAULT ''");
    }
    if (!hasQCol('matching_pairs_json')) {
      this.db.exec("ALTER TABLE questions ADD COLUMN matching_pairs_json TEXT NOT NULL DEFAULT '[]'");
    }
    if (!hasQCol('ordering_items_json')) {
      this.db.exec("ALTER TABLE questions ADD COLUMN ordering_items_json TEXT NOT NULL DEFAULT '[]'");
    }

    const qsCols = this.db
      .prepare('PRAGMA table_info(question_sets)')
      .all() as Array<{ name: string }>;
    const hasQsCol = (col: string) => qsCols.some((c) => c.name === col);
    if (!hasQsCol('topic')) {
      this.db.exec("ALTER TABLE question_sets ADD COLUMN topic TEXT NOT NULL DEFAULT 'Chuyên đề chung'");
    }
    if (!hasQsCol('shared_with_json')) {
      this.db.exec("ALTER TABLE question_sets ADD COLUMN shared_with_json TEXT NOT NULL DEFAULT '[]'");
    }
    if (!hasQsCol('default_points')) {
      this.db.exec('ALTER TABLE question_sets ADD COLUMN default_points INTEGER NOT NULL DEFAULT 1000');
    }
    if (!hasQsCol('default_time_limit_sec')) {
      this.db.exec('ALTER TABLE question_sets ADD COLUMN default_time_limit_sec INTEGER NOT NULL DEFAULT 20');
    }
    if (!hasQsCol('updated_at')) {
      this.db.exec("ALTER TABLE question_sets ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''");
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS question_categories (
        id TEXT PRIMARY KEY,
        education_level TEXT NOT NULL,
        grade_level TEXT NOT NULL,
        subject TEXT NOT NULL,
        topic TEXT NOT NULL,
        lesson TEXT NOT NULL,
        creator_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_question_categories_subj ON question_categories(subject, grade_level);
    `);

    const roomCols = this.db
      .prepare('PRAGMA table_info(game_rooms)')
      .all() as Array<{ name: string }>;
    if (!roomCols.some((c) => c.name === 'snapshot_json')) {
      this.db.exec("ALTER TABLE game_rooms ADD COLUMN snapshot_json TEXT NOT NULL DEFAULT ''");
    }

    // Backfill question_code, subject, grade_level, created_at on existing questions
    const nowIso = new Date().toISOString();
    const qNeedBackfill = this.db
      .prepare(
        "SELECT q.id, q.question_code, q.created_at, qs.subject, qs.grade_level FROM questions q LEFT JOIN question_sets qs ON qs.id = q.question_set_id WHERE q.question_code = '' OR q.created_at = ''"
      )
      .all() as Array<{
        id: string;
        question_code: string;
        created_at: string;
        subject: string | null;
        grade_level: string | null;
      }>;
    const updateQBackfill = this.db.prepare(
      'UPDATE questions SET question_code = ?, subject = ?, grade_level = ?, created_at = ?, updated_at = ? WHERE id = ?'
    );
    qNeedBackfill.forEach((row, idx) => {
      const code = row.question_code || `QB-${String(idx + 101).padStart(4, '0')}`;
      updateQBackfill.run(
        code,
        row.subject || 'Vật lý',
        row.grade_level || 'Khối 12',
        row.created_at || nowIso,
        row.created_at || nowIso,
        row.id
      );
    });

    // Seed initial categories if empty
    const catCount = this.db.prepare('SELECT COUNT(*) as c FROM question_categories').get() as { c: number };
    if (catCount.c === 0) {
      const insertCat = this.db.prepare(
        'INSERT INTO question_categories (id, education_level, grade_level, subject, topic, lesson, creator_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      insertCat.run('cat_vl_12_1', 'THPT', 'Khối 12', 'Vật lý', 'Dao động và Sóng điện từ', 'Bài 1: Dao động điều hòa & Lượng tử ánh sáng', 'usr_teacher_demo', nowIso);
      insertCat.run('cat_th_11_1', 'THPT', 'Khối 11 - 12', 'Tin học', 'Thuật toán và Bảo mật Web', 'Bài 2: Độ phức tạp Big-O & Phòng chống SQL Injection', 'usr_teacher_demo', nowIso);
      insertCat.run('cat_toan_12_1', 'THPT', 'Khối 12', 'Toán học', 'Giải tích & Tổ hợp Xác suất', 'Bài 3: Đạo hàm, Logarit và Hoán vị', 'usr_teacher_demo', nowIso);
    }

    // Backfill empty usernames from email prefix
    const emptyUsernameUsers = this.db
      .prepare("SELECT id, email FROM users WHERE username = '' OR username IS NULL")
      .all() as Array<{ id: string; email: string }>;
    const updateUsername = this.db.prepare('UPDATE users SET username = ? WHERE id = ?');
    for (const u of emptyUsernameUsers) {
      const prefix = u.email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '');
      updateUsername.run(prefix || u.id, u.id);
    }
  }

  private seedInitialContentIfNeeded(): void {
    const now = new Date().toISOString();

    const insertRole = this.db.prepare(`
      INSERT OR IGNORE INTO roles (id, code, name, description, permissions_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertRole.run(
      'role_admin',
      'ADMIN',
      'Quản trị viên hệ thống',
      'Toàn quyền quản lý người dùng, phân quyền RBAC, lớp học, ngân hàng đề và giám sát hệ thống.',
      JSON.stringify([
        'users:read',
        'users:write',
        'roles:manage',
        'classes:manage',
        'questions:manage',
        'quiz:manage',
        'rooms:host',
        'reports:read',
        'admin:access',
      ]),
      now
    );
    insertRole.run(
      'role_teacher',
      'TEACHER',
      'Giáo viên',
      'Tạo và quản lý lớp học, biên soạn câu hỏi và bài kiểm tra, tổ chức và điều phối phòng thi đấu.',
      JSON.stringify([
        'classes:manage',
        'questions:manage',
        'quiz:manage',
        'rooms:host',
        'reports:read',
      ]),
      now
    );
    insertRole.run(
      'role_student',
      'STUDENT',
      'Học sinh',
      'Tham gia lớp học bằng mã lớp, vào phòng thi đấu bằng mã PIN, tự mở lượt chơi thử nghiệm và xem lịch sử kết quả.',
      JSON.stringify(['classes:join', 'rooms:join', 'rooms:test_mode', 'leaderboard:read']),
      now
    );

    const countRow = this.db.prepare('SELECT COUNT(*) as cnt FROM question_sets').get() as {
      cnt: number;
    };

    if (countRow.cnt === 0) {
      const teacherId = 'usr_teacher_demo';
      const student1Id = 'usr_student_demo1';
      const student2Id = 'usr_student_demo2';

      const insertUser = this.db.prepare(`
        INSERT OR IGNORE INTO users (id, username, email, full_name, password_hash, role, school_name, class_name, bio, is_locked, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      `);

      insertUser.run(
        teacherId,
        'hoang.nguyen',
        'giaovien.demo@quizzi.edu.vn',
        'ThS. Nguyễn Minh Hoàng',
        'DEMO_LOCKED_HASH',
        'TEACHER',
        'Trường THPT Chuyên Chu Văn An',
        'Tổ Toán - Lý - Tin',
        'Giáo viên Vật lý & Toán ứng dụng — Phụ trách đội tuyển học sinh giỏi.',
        now
      );

      insertUser.run(
        student1Id,
        'baongoc.12a1',
        'hocsinh.demo@quizzi.edu.vn',
        'Trần Bảo Ngọc',
        'DEMO_LOCKED_HASH',
        'STUDENT',
        'Trường THPT Chuyên Chu Văn An',
        'Lớp 12A1',
        'Học sinh lớp 12A1 — Yêu thích Toán học, Vật lý và Lập trình.',
        now
      );

      insertUser.run(
        student2Id,
        'tuankhang.11b2',
        'le.khang@quizzi.edu.vn',
        'Lê Tuấn Khang',
        'DEMO_LOCKED_HASH',
        'STUDENT',
        'Trường THPT Lê Hồng Phong',
        'Lớp 11B2',
        'Thành viên CLB Tin học trẻ.',
        now
      );

      const class1Id = 'cls_12a1_toan';
      const class2Id = 'cls_11b2_tinhoc';
      const insertClass = this.db.prepare(`
        INSERT INTO classrooms (id, code, name, subject, grade_level, description, teacher_id, is_locked, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
      `);

      insertClass.run(
        class1Id,
        'TOAN12A1',
        'Lớp 12A1 — Ôn Thi THPT Quốc Gia & Đánh Giá Tư Duy',
        'Toán học & Vật lý',
        'Khối 12',
        'Lớp luyện đề phản xạ nhanh và thi đấu tuần môn Toán - Lý.',
        teacherId,
        now
      );

      insertClass.run(
        class2Id,
        'TIN11PRO',
        'CLB Thuật Toán & Lập Trình Thi Đấu Khối 11',
        'Tin học',
        'Khối 11',
        'Đấu trường kiểm tra cấu trúc dữ liệu, độ phức tạp thuật toán và mạng máy tính.',
        teacherId,
        now
      );

      const insertMember = this.db.prepare(`
        INSERT OR IGNORE INTO classroom_members (id, classroom_id, student_id, joined_at)
        VALUES (?, ?, ?, ?)
      `);
      insertMember.run('cm_1', class1Id, student1Id, now);
      insertMember.run('cm_2', class1Id, student2Id, now);
      insertMember.run('cm_3', class2Id, student1Id, now);

      const insertSet = this.db.prepare(`
        INSERT INTO question_sets (id, title, subject, grade_level, description, creator_id, is_public, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?)
      `);

      const set1Id = 'qset_vatly_12';
      insertSet.run(
        set1Id,
        'Đấu Trường Vật Lý Hiện Đại & Cơ Học Ứng Dụng',
        'Vật lý',
        'Khối 12',
        'Bộ câu hỏi kiểm tra phản xạ nhanh về dao động cơ, sóng điện từ và lượng tử ánh sáng.',
        teacherId,
        now
      );

      const set1Questions: Array<{
        id: string;
        prompt: string;
        options: [string, string, string, string];
        correctIndex: number;
        timeLimitSec: number;
        points: number;
        explanation: string;
      }> = [
        {
          id: 'q_vl_1',
          prompt:
            'Một vật dao động điều hòa theo phương trình x = 6cos(4πt) (cm). Tần số dao động của vật là bao nhiêu?',
          options: ['2 Hz', '4 Hz', '0.5 Hz', '4π Hz'],
          correctIndex: 0,
          timeLimitSec: 20,
          points: 1000,
          explanation: 'Tần số góc ω = 4π rad/s → Tần số f = ω / (2π) = 4π / (2π) = 2 Hz.',
        },
        {
          id: 'q_vl_2',
          prompt:
            'Trong chân không, sóng điện từ có bước sóng nào sau đây thuộc vùng ánh sáng nhìn thấy?',
          options: [
            '0,55 μm (Ánh sáng lục)',
            '120 nm (Tia tử ngoại)',
            '15 μm (Tia hồng ngoại)',
            '0,02 nm (Tia X)',
          ],
          correctIndex: 0,
          timeLimitSec: 20,
          points: 1000,
          explanation:
            'Ánh sáng nhìn thấy có bước sóng trong khoảng từ 0,38 μm (tím) đến 0,76 μm (đỏ). 0,55 μm nằm trong vùng này.',
        },
        {
          id: 'q_vl_3',
          prompt:
            'Khi truyền từ không khí vào nước, đại lượng nào của sóng ánh sáng đơn sắc KHÔNG thay đổi?',
          options: [
            'Tần số ánh sáng',
            'Tốc độ truyền sóng',
            'Bước sóng ánh sáng',
            'Chiết suất môi trường',
          ],
          correctIndex: 0,
          timeLimitSec: 20,
          points: 1000,
          explanation:
            'Tần số (và chu kỳ) của sóng ánh sáng phụ thuộc vào nguồn phát, không thay đổi khi truyền qua các môi trường khác nhau.',
        },
        {
          id: 'q_vl_4',
          prompt:
            'Theo thuyết lượng tử ánh sáng của Einstein, năng lượng của mỗi photon tỉ lệ thuận với đại lượng nào?',
          options: [
            'Tần số của ánh sáng đơn sắc',
            'Bước sóng của ánh sáng',
            'Cường độ chùm sáng',
            'Khoảng cách tới nguồn sáng',
          ],
          correctIndex: 0,
          timeLimitSec: 20,
          points: 1000,
          explanation:
            'Theo công thức ε = h.f, năng lượng photon tỉ lệ thuận với tần số f của ánh sáng.',
        },
      ];

      set1Questions.forEach((q, idx) => {
        this.insertNormalizedQuestion(set1Id, q.id, idx, q);
      });

      const set2Id = 'qset_tinhoc_algo';
      insertSet.run(
        set2Id,
        'Tư Duy Thuật Toán, Cấu Trúc Dữ Liệu & Bảo Mật Web',
        'Tin học',
        'Khối 11 - 12',
        'Kiểm tra kiến thức cốt lõi về độ phức tạp thuật toán Big-O, mạng máy tính và an toàn hệ thống.',
        teacherId,
        now
      );

      const set2Questions: Array<{
        id: string;
        prompt: string;
        options: [string, string, string, string];
        correctIndex: number;
        timeLimitSec: number;
        points: number;
        explanation: string;
      }> = [
        {
          id: 'q_th_1',
          prompt:
            'Độ phức tạp thời gian trung bình của thuật toán Tìm kiếm nhị phân (Binary Search) trên mảng đã sắp xếp gồm N phần tử là gì?',
          options: ['O(log N)', 'O(N)', 'O(N log N)', 'O(1)'],
          correctIndex: 0,
          timeLimitSec: 20,
          points: 1000,
          explanation:
            'Mỗi bước Binary Search chia đôi không gian tìm kiếm, do đó số bước tối đa tỉ lệ với log₂(N).',
        },
        {
          id: 'q_th_2',
          prompt:
            'Cấu trúc dữ liệu nào hoạt động theo nguyên tắc LIFO (Last In, First Out — Vào sau, Ra trước)?',
          options: [
            'Ngăn xếp (Stack)',
            'Hàng đợi (Queue)',
            'Bảng băm (Hash Table)',
            'Đồ thị hai phía (Bipartite Graph)',
          ],
          correctIndex: 0,
          timeLimitSec: 15,
          points: 1000,
          explanation:
            'Stack (Ngăn xếp) thực hiện thao tác push và pop ở cùng một đỉnh, tuân theo nguyên tắc LIFO.',
        },
        {
          id: 'q_th_3',
          prompt:
            'Trong kiến trúc ứng dụng thi đấu trực tuyến, tại sao máy chủ KHÔNG ĐƯỢC gửi trường đáp án đúng xuống trình duyệt học sinh khi câu hỏi đang diễn ra?',
          options: [
            'Ngăn học sinh mở DevTools (Network/WebSocket) để đọc trước đáp án đúng',
            'Để giảm dung lượng bộ nhớ RAM của màn hình',
            'Vì giao thức HTTP không hỗ trợ truyền số nguyên',
            'Để tự động tăng tốc độ khung hình CSS',
          ],
          correctIndex: 0,
          timeLimitSec: 20,
          points: 1000,
          explanation:
            'Nếu gửi đáp án đúng xuống client trước khi hết giờ, người dùng có thể kiểm tra gói tin mạng để gian lận.',
        },
        {
          id: 'q_th_4',
          prompt:
            'Biện pháp nào dưới đây chống lại tấn công SQL Injection hiệu quả nhất ở tầng cơ sở dữ liệu?',
          options: [
            'Sử dụng câu lệnh truy vấn có tham số hóa (Parameterized Queries / Prepared Statements)',
            'Chỉ kiểm tra dữ liệu bằng thuộc tính required trong HTML',
            'Ẩn nút gửi biểu mẫu bằng CSS khi có ký tự lạ',
            'Đổi tên bảng cơ sở dữ liệu sang chữ in hoa',
          ],
          correctIndex: 0,
          timeLimitSec: 20,
          points: 1000,
          explanation:
            'Parameterized Queries tách biệt hoàn toàn cấu trúc lệnh SQL và dữ liệu đầu vào của người dùng.',
        },
      ];

      set2Questions.forEach((q, idx) => {
        this.insertNormalizedQuestion(set2Id, q.id, idx, q);
      });

      const set3Id = 'qset_toanhoc_12';
      insertSet.run(
        set3Id,
        'Giải Tích & Tổ Hợp Xác Suất — Phản Xạ 90 Giây',
        'Toán học',
        'Khối 12',
        'Bộ câu hỏi đạo hàm, cực trị hàm số, logarit và xác suất cổ điển.',
        teacherId,
        now
      );

      const set3Questions: Array<{
        id: string;
        prompt: string;
        options: [string, string, string, string];
        correctIndex: number;
        timeLimitSec: number;
        points: number;
        explanation: string;
      }> = [
        {
          id: 'q_toan_1',
          prompt:
            'Đạo hàm của hàm số y = x³ - 3x² + 2 tại điểm x = 3 có giá trị bằng bao nhiêu?',
          options: ['9', '6', '0', '12'],
          correctIndex: 0,
          timeLimitSec: 20,
          points: 1000,
          explanation: "Ta có y' = 3x² - 6x. Thay x = 3 vào: y'(3) = 3.(3²) - 6.3 = 27 - 18 = 9.",
        },
        {
          id: 'q_toan_2',
          prompt:
            'Với a là số thực dương tùy ý khác 1, giá trị của biểu thức logₐ(a⁵) bằng bao nhiêu?',
          options: ['5', '1/5', 'a⁵', '25'],
          correctIndex: 0,
          timeLimitSec: 15,
          points: 1000,
          explanation: 'Theo tính chất cơ bản của logarit: logₐ(a^α) = α, nên logₐ(a⁵) = 5.',
        },
        {
          id: 'q_toan_3',
          prompt: 'Có bao nhiêu cách xếp 5 học sinh vào một bàn dài có 5 ghế ngồi?',
          options: ['120 cách', '25 cách', '60 cách', '24 cách'],
          correctIndex: 0,
          timeLimitSec: 20,
          points: 1000,
          explanation:
            'Số cách xếp 5 học sinh vào 5 vị trí là số hoán vị của 5 phần tử: P₅ = 5! = 120 cách.',
        },
      ];

      set3Questions.forEach((q, idx) => {
        this.insertNormalizedQuestion(set3Id, q.id, idx, q);
      });

      const matchId = 'match_initial_01';
      this.db
        .prepare(`
          INSERT INTO completed_matches (id, room_code, room_title, question_set_id, question_set_title, host_id, host_name, total_questions, participant_count, finished_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          matchId,
          '842910',
          'Thi Đấu Tuần 1 — Vật Lý 12A1',
          set1Id,
          'Đấu Trường Vật Lý Hiện Đại & Cơ Học Ứng Dụng',
          teacherId,
          'ThS. Nguyễn Minh Hoàng',
          4,
          2,
          now
        );

      const insertResult = this.db.prepare(`
        INSERT INTO match_results (id, match_id, user_id, display_name, role, score, correct_count, rank_position)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertResult.run('mr_1', matchId, student1Id, 'Trần Bảo Ngọc', 'STUDENT', 3740, 4, 1);
      insertResult.run('mr_2', matchId, student2Id, 'Lê Tuấn Khang', 'STUDENT', 2810, 3, 2);
    }

    this.refreshMaterializedLeaderboard();
  }

  private insertNormalizedQuestion(
    questionSetId: string,
    questionId: string,
    orderIndex: number,
    q: {
      questionType?: QuestionType;
      prompt: string;
      imageUrl?: string;
      audioUrl?: string;
      videoUrl?: string;
      options: string[];
      correctIndex: number;
      correctIndices?: number[];
      timeLimitSec: number;
      points: number;
      explanation: string;
    }
  ): void {
    const qType: QuestionType = q.questionType || 'SINGLE_CHOICE';
    const cIndices =
      Array.isArray(q.correctIndices) && q.correctIndices.length > 0
        ? q.correctIndices
        : [q.correctIndex];

    this.db
      .prepare(`
        INSERT OR IGNORE INTO questions
        (id, question_set_id, order_index, question_type, prompt, image_url, audio_url, video_url, options_json, correct_index, correct_indices_json, time_limit_sec, points, explanation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        questionId,
        questionSetId,
        orderIndex,
        qType,
        q.prompt,
        q.imageUrl || '',
        q.audioUrl || '',
        q.videoUrl || '',
        JSON.stringify(q.options),
        q.correctIndex,
        JSON.stringify(cIndices),
        q.timeLimitSec,
        q.points,
        q.explanation
      );

    const insertOpt = this.db.prepare(`
      INSERT OR IGNORE INTO question_options (id, question_id, option_index, option_text, is_correct)
      VALUES (?, ?, ?, ?, ?)
    `);
    q.options.forEach((optText, idx) => {
      insertOpt.run(
        `qopt_${questionId}_${idx}`,
        questionId,
        idx,
        optText,
        cIndices.includes(idx) ? 1 : 0
      );
    });

    this.db
      .prepare(`
        INSERT OR IGNORE INTO quiz_questions (id, quiz_id, question_id, order_index, points_override, time_limit_override)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        `qq_${questionSetId}_${questionId}`,
        questionSetId,
        questionId,
        orderIndex,
        q.points,
        q.timeLimitSec
      );
  }

  public listRoles(): RoleEntity[] {
    const rows = this.db.prepare('SELECT * FROM roles ORDER BY created_at ASC').all() as any[];
    return rows.map((r) => {
      let perms: string[] = [];
      try {
        perms = JSON.parse(r.permissions_json);
      } catch {
        perms = [];
      }
      return {
        id: r.id,
        code: r.code as UserRole,
        name: r.name,
        description: r.description,
        permissions: perms,
        createdAt: r.created_at,
      };
    });
  }

  private mapUserRow(row: any): UserProfile {
    const emailPrefix = String(row.email || '').split('@')[0];
    return {
      id: row.id,
      username: row.username || emailPrefix,
      email: row.email,
      fullName: row.full_name,
      avatarUrl: row.avatar_url || '',
      role: row.role as UserRole,
      schoolName: row.school_name || '',
      className: row.class_name || '',
      bio: row.bio || '',
      isLocked: Boolean(row.is_locked),
      createdAt: row.created_at,
    };
  }

  public isAdminInitialized(): boolean {
    const row = this.db
      .prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'ADMIN'")
      .get() as { cnt: number };
    return row.cnt > 0;
  }

  public getUserById(id: string): UserProfile | null {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return row ? this.mapUserRow(row) : null;
  }

  public getStoredUserById(id: string): StoredUserRecord | null {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      ...this.mapUserRow(row),
      passwordHash: row.password_hash,
    };
  }

  public getStoredUserByEmail(email: string): StoredUserRecord | null {
    const row = this.db
      .prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)')
      .get(email.trim()) as any;
    if (!row) return null;
    return {
      ...this.mapUserRow(row),
      passwordHash: row.password_hash,
    };
  }

  public getStoredUserByUsername(username: string): StoredUserRecord | null {
    const row = this.db
      .prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)')
      .get(username.trim()) as any;
    if (!row) return null;
    return {
      ...this.mapUserRow(row),
      passwordHash: row.password_hash,
    };
  }

  public createUser(params: {
    email: string;
    username?: string;
    fullName: string;
    passwordHash: string;
    role: UserRole;
    schoolName?: string;
    className?: string;
    avatarUrl?: string;
    bio?: string;
  }): UserProfile {
    const id = `usr_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();
    const normalizedEmail = params.email.trim().toLowerCase();
    const defaultUsername =
      (params.username || '').trim() ||
      normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '');

    this.db
      .prepare(`
        INSERT INTO users (id, username, email, full_name, avatar_url, password_hash, role, school_name, class_name, bio, is_locked, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      `)
      .run(
        id,
        defaultUsername,
        normalizedEmail,
        params.fullName.trim(),
        (params.avatarUrl || '').trim(),
        params.passwordHash,
        params.role,
        (params.schoolName || '').trim(),
        (params.className || '').trim(),
        (params.bio || '').trim(),
        now
      );

    const created = this.getUserById(id)!;
    this.logActivity({
      actorId: created.id,
      actorName: created.fullName,
      actorRole: created.role,
      action: 'USER_REGISTERED',
      module: 'Authentication',
      targetId: created.id,
      details: `Tạo tài khoản ${created.email} (${created.role})`,
    });
    return created;
  }

  public updateUserProfile(
    userId: string,
    updates: {
      fullName: string;
      username?: string;
      avatarUrl?: string;
      schoolName: string;
      className?: string;
      bio: string;
      passwordHash?: string;
    }
  ): UserProfile | null {
    const existing = this.getUserById(userId);
    if (!existing) return null;

    const nextUsername =
      updates.username !== undefined && updates.username.trim()
        ? updates.username.trim()
        : existing.username || existing.email.split('@')[0];
    const nextAvatar =
      updates.avatarUrl !== undefined ? updates.avatarUrl.trim() : existing.avatarUrl || '';
    const nextClass =
      updates.className !== undefined ? updates.className.trim() : existing.className || '';

    if (updates.passwordHash) {
      this.db
        .prepare(`
          UPDATE users
          SET full_name = ?, username = ?, avatar_url = ?, school_name = ?, class_name = ?, bio = ?, password_hash = ?
          WHERE id = ?
        `)
        .run(
          updates.fullName.trim(),
          nextUsername,
          nextAvatar,
          updates.schoolName.trim(),
          nextClass,
          updates.bio.trim(),
          updates.passwordHash,
          userId
        );
    } else {
      this.db
        .prepare(`
          UPDATE users
          SET full_name = ?, username = ?, avatar_url = ?, school_name = ?, class_name = ?, bio = ?
          WHERE id = ?
        `)
        .run(
          updates.fullName.trim(),
          nextUsername,
          nextAvatar,
          updates.schoolName.trim(),
          nextClass,
          updates.bio.trim(),
          userId
        );
    }
    return this.getUserById(userId);
  }

  public updateUserPassword(userId: string, passwordHash: string): boolean {
    const info = this.db
      .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .run(passwordHash, userId);
    return info.changes > 0;
  }

  public createPasswordResetToken(
    email: string
  ): { resetCode: string; expiresAt: string; user: UserProfile } | null {
    const stored = this.getStoredUserByEmail(email);
    if (!stored || stored.isLocked) return null;

    // 6-digit numeric recovery token valid for 15 minutes
    const resetCode = String(Math.floor(100000 + Math.random() * 900000));
    const tokenHash = crypto.createHash('sha256').update(resetCode).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    this.db
      .prepare('UPDATE password_reset_tokens SET used = 1 WHERE user_id = ?')
      .run(stored.id);

    this.db
      .prepare(`
        INSERT INTO password_reset_tokens (id, user_id, email, token_hash, expires_at, used, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?)
      `)
      .run(
        `prt_${crypto.randomBytes(8).toString('hex')}`,
        stored.id,
        stored.email,
        tokenHash,
        expiresAt,
        now
      );

    return { resetCode, expiresAt, user: stored };
  }

  public consumePasswordResetToken(
    email: string,
    resetCode: string,
    newPasswordHash: string
  ): UserProfile | null {
    const stored = this.getStoredUserByEmail(email);
    if (!stored) return null;

    const tokenHash = crypto.createHash('sha256').update(resetCode.trim()).digest('hex');
    const row = this.db
      .prepare(`
        SELECT * FROM password_reset_tokens
        WHERE user_id = ? AND token_hash = ? AND used = 0
        ORDER BY created_at DESC LIMIT 1
      `)
      .get(stored.id, tokenHash) as any;

    if (!row) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return null;
    }

    const tx = this.db.transaction(() => {
      this.db
        .prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?')
        .run(row.id);
      this.db
        .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
        .run(newPasswordHash, stored.id);
    });
    tx();

    return this.getUserById(stored.id);
  }

  public listAllUsers(
    page = 1,
    limit = 50,
    filters?: { role?: UserRole; search?: string; status?: 'ALL' | 'ACTIVE' | 'LOCKED' }
  ): { users: UserProfile[]; pagination: PaginationMetadata } {
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (filters?.role) {
      whereClauses.push('role = ?');
      params.push(filters.role);
    }
    if (filters?.status === 'ACTIVE') {
      whereClauses.push('is_locked = 0');
    } else if (filters?.status === 'LOCKED') {
      whereClauses.push('is_locked = 1');
    }
    if (filters?.search && filters.search.trim()) {
      const q = `%${filters.search.trim().toLowerCase()}%`;
      whereClauses.push(
        '(LOWER(full_name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(username) LIKE ? OR LOWER(school_name) LIKE ?)'
      );
      params.push(q, q, q, q);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const total = (
      this.db
        .prepare(`SELECT COUNT(*) as c FROM users ${whereSql}`)
        .get(...params) as { c: number }
    ).c;

    const offset = Math.max(0, (page - 1) * limit);
    const rows = this.db
      .prepare(
        `SELECT * FROM users ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    return {
      users: rows.map((r) => this.mapUserRow(r)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  public adminUpdateUser(
    userId: string,
    updates: {
      fullName?: string;
      username?: string;
      email?: string;
      schoolName?: string;
      className?: string;
      bio?: string;
      role?: UserRole;
      isLocked?: boolean;
      passwordHash?: string;
    }
  ): UserProfile | null {
    const current = this.getStoredUserById(userId);
    if (!current) return null;

    const nextFullName = updates.fullName?.trim() || current.fullName;
    const nextUsername = updates.username?.trim() || current.username || '';
    const nextEmail = updates.email?.trim().toLowerCase() || current.email;
    const nextSchool =
      updates.schoolName !== undefined ? updates.schoolName.trim() : current.schoolName;
    const nextClass =
      updates.className !== undefined ? updates.className.trim() : current.className || '';
    const nextBio = updates.bio !== undefined ? updates.bio.trim() : current.bio;
    const nextRole = updates.role || current.role;
    const nextLocked =
      updates.isLocked !== undefined ? (updates.isLocked ? 1 : 0) : current.isLocked ? 1 : 0;
    const nextPassHash = updates.passwordHash || current.passwordHash;

    this.db
      .prepare(`
        UPDATE users
        SET full_name = ?, username = ?, email = ?, school_name = ?, class_name = ?, bio = ?, role = ?, is_locked = ?, password_hash = ?
        WHERE id = ?
      `)
      .run(
        nextFullName,
        nextUsername,
        nextEmail,
        nextSchool,
        nextClass,
        nextBio,
        nextRole,
        nextLocked,
        nextPassHash,
        userId
      );

    return this.getUserById(userId);
  }

  public updateUserRoleOrLock(
    userId: string,
    role: UserRole,
    isLocked: boolean
  ): UserProfile | null {
    this.db
      .prepare('UPDATE users SET role = ?, is_locked = ? WHERE id = ?')
      .run(role, isLocked ? 1 : 0, userId);
    return this.getUserById(userId);
  }

  public getTeacherDetailStats(teacherId: string): TeacherDetailStats | null {
    const teacher = this.getUserById(teacherId);
    if (!teacher) return null;

    const classRows = this.db
      .prepare(`
        SELECT c.*, u.full_name as teacher_name,
               (SELECT COUNT(*) FROM classroom_members cm WHERE cm.classroom_id = c.id) as student_count
        FROM classrooms c
        LEFT JOIN users u ON u.id = c.teacher_id
        WHERE c.teacher_id = ?
        ORDER BY c.created_at DESC
      `)
      .all(teacherId);

    const qSetCount = (
      this.db
        .prepare('SELECT COUNT(*) as c FROM question_sets WHERE creator_id = ?')
        .get(teacherId) as { c: number }
    ).c;

    const hostedMatchCount = (
      this.db
        .prepare('SELECT COUNT(*) as c FROM completed_matches WHERE host_id = ?')
        .get(teacherId) as { c: number }
    ).c;

    const actRows = this.db
      .prepare(
        'SELECT * FROM activity_logs WHERE actor_id = ? ORDER BY created_at DESC LIMIT 15'
      )
      .all(teacherId) as any[];

    return {
      teacher,
      classrooms: classRows.map((r) => this.mapClassroomRow(r)),
      questionSetCount: qSetCount,
      hostedMatchCount,
      recentActivities: actRows.map((r) => ({
        id: r.id,
        actorId: r.actor_id,
        actorName: r.actor_name,
        actorRole: r.actor_role as UserRole,
        action: r.action,
        module: r.module,
        targetId: r.target_id,
        details: r.details,
        createdAt: r.created_at,
      })),
    };
  }

  public listStudentsForActor(
    actor: UserProfile,
    options?: {
      search?: string;
      classroomId?: string;
      status?: 'ALL' | 'ACTIVE' | 'LOCKED';
      page?: number;
      limit?: number;
    }
  ): { students: UserProfile[]; pagination: PaginationMetadata } {
    const page = options?.page && options.page > 0 ? options.page : 1;
    const limit = options?.limit && options.limit > 0 ? options.limit : 30;
    const offset = (page - 1) * limit;

    const whereClauses: string[] = ["u.role = 'STUDENT'"];
    const params: any[] = [];

    if (options?.status === 'ACTIVE') {
      whereClauses.push('u.is_locked = 0');
    } else if (options?.status === 'LOCKED') {
      whereClauses.push('u.is_locked = 1');
    }

    if (options?.search && options.search.trim()) {
      const q = `%${options.search.trim().toLowerCase()}%`;
      whereClauses.push(
        '(LOWER(u.full_name) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(u.username) LIKE ? OR LOWER(u.school_name) LIKE ?)'
      );
      params.push(q, q, q, q);
    }

    if (options?.classroomId && options.classroomId !== 'ALL') {
      whereClauses.push(
        'EXISTS (SELECT 1 FROM classroom_members cm WHERE cm.student_id = u.id AND cm.classroom_id = ?)'
      );
      params.push(options.classroomId);
    } else if (actor.role === 'TEACHER') {
      // Teacher without specific classroom filter sees students in their managed classrooms or all students in demo school
      whereClauses.push(
        `EXISTS (
          SELECT 1 FROM classroom_members cm
          INNER JOIN classrooms c ON c.id = cm.classroom_id
          WHERE cm.student_id = u.id AND (c.teacher_id = ? OR c.teacher_id = 'usr_teacher_demo')
        )`
      );
      params.push(actor.id);
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
    const total = (
      this.db
        .prepare(`SELECT COUNT(*) as c FROM users u ${whereSql}`)
        .get(...params) as { c: number }
    ).c;

    const rows = this.db
      .prepare(
        `SELECT u.* FROM users u ${whereSql} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    return {
      students: rows.map((r) => this.mapUserRow(r)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  public getStudentAchievementDetail(studentId: string): StudentAchievementDetail | null {
    const student = this.getUserById(studentId);
    if (!student) return null;

    const classRows = this.db
      .prepare(`
        SELECT c.*, u.full_name as teacher_name,
               (SELECT COUNT(*) FROM classroom_members cm WHERE cm.classroom_id = c.id) as student_count
        FROM classrooms c
        INNER JOIN classroom_members m ON m.classroom_id = c.id
        LEFT JOIN users u ON u.id = c.teacher_id
        WHERE m.student_id = ?
        ORDER BY m.joined_at DESC
      `)
      .all(studentId);

    const lbRow = this.db
      .prepare('SELECT * FROM leaderboards WHERE user_id = ?')
      .get(studentId) as any;

    const recentMatches = this.listMatchHistory(studentId, 1, 15).history.filter(
      (m) => m.userScore !== undefined
    );

    return {
      student,
      enrolledClassrooms: classRows.map((r) => this.mapClassroomRow(r)),
      totalScore: Number(lbRow?.total_score || 0),
      matchesPlayed: Number(lbRow?.matches_played || 0),
      totalCorrect: Number(lbRow?.total_correct || 0),
      totalAnswered: Number(lbRow?.total_answered || 0),
      accuracyPercent: Number(lbRow?.accuracy_percent || 0),
      recentMatches,
    };
  }

  public transferStudentClassroom(
    studentId: string,
    fromClassroomId: string | null,
    toClassroomId: string
  ): boolean {
    const tx = this.db.transaction(() => {
      if (fromClassroomId && fromClassroomId !== toClassroomId) {
        this.removeStudentFromClassroom(fromClassroomId, studentId);
      }
      this.joinClassroom(toClassroomId, studentId);
      const targetClass = this.getClassroomById(toClassroomId);
      if (targetClass) {
        this.db
          .prepare('UPDATE users SET class_name = ? WHERE id = ?')
          .run(targetClass.name, studentId);
      }
    });
    tx();
    return true;
  }

  public bulkImportStudents(
    rows: StudentImportRowInput[],
    defaultPasswordHashFn: (rawPass: string) => string
  ): StudentImportResult {
    const errors: Array<{ rowNumber: number; email: string; message: string }> = [];
    const createdStudents: UserProfile[] = [];
    let importedCount = 0;
    let enrolledCount = 0;
    let skippedCount = 0;

    const seenEmailsInBatch = new Set<string>();

    for (const row of rows) {
      const email = (row.email || '').trim().toLowerCase();
      const fullName = (row.fullName || '').trim();
      const rowNum = row.rowNumber || 0;

      if (!email || !email.includes('@')) {
        errors.push({
          rowNumber: rowNum,
          email: email || '(Trống)',
          message: 'Định dạng Email không hợp lệ.',
        });
        skippedCount += 1;
        continue;
      }

      if (fullName.length < 2) {
        errors.push({
          rowNumber: rowNum,
          email,
          message: 'Họ và tên học sinh phải có ít nhất 2 ký tự.',
        });
        skippedCount += 1;
        continue;
      }

      if (seenEmailsInBatch.has(email)) {
        errors.push({
          rowNumber: rowNum,
          email,
          message: 'Bản ghi trùng lặp Email ngay trong tệp tải lên.',
        });
        skippedCount += 1;
        continue;
      }
      seenEmailsInBatch.add(email);

      let studentProfile = this.getStoredUserByEmail(email) as UserProfile | null;
      if (studentProfile) {
        // Existing user: if classroomCode is provided, enroll them if not already in class
        if (row.classroomCode && row.classroomCode.trim()) {
          const cls = this.getClassroomByCode(row.classroomCode.trim());
          if (!cls) {
            errors.push({
              rowNumber: rowNum,
              email,
              message: `Tài khoản đã tồn tại, nhưng mã lớp "${row.classroomCode}" không hợp lệ.`,
            });
            skippedCount += 1;
            continue;
          }
          if (this.joinClassroom(cls.id, studentProfile.id)) {
            enrolledCount += 1;
          } else {
            errors.push({
              rowNumber: rowNum,
              email,
              message: `Học sinh đã có tài khoản và đã thuộc lớp ${cls.code}.`,
            });
            skippedCount += 1;
          }
        } else {
          errors.push({
            rowNumber: rowNum,
            email,
            message: 'Email này đã tồn tại trên hệ thống.',
          });
          skippedCount += 1;
        }
        continue;
      }

      // Create new student account
      const rawPassword =
        row.password && row.password.trim().length >= 6
          ? row.password.trim()
          : 'Quizzi@123';
      const passwordHash = defaultPasswordHashFn(rawPassword);

      let targetClass: Classroom | null = null;
      if (row.classroomCode && row.classroomCode.trim()) {
        targetClass = this.getClassroomByCode(row.classroomCode.trim());
        if (!targetClass) {
          errors.push({
            rowNumber: rowNum,
            email,
            message: `Mã lớp "${row.classroomCode}" không tồn tại.`,
          });
          skippedCount += 1;
          continue;
        }
      }

      studentProfile = this.createUser({
        email,
        username: row.username?.trim() || email.split('@')[0],
        fullName,
        passwordHash,
        role: 'STUDENT',
        schoolName: row.schoolName?.trim() || 'Trường THPT',
        className: targetClass ? targetClass.name : '',
      });

      importedCount += 1;
      createdStudents.push(studentProfile);

      if (targetClass) {
        if (this.joinClassroom(targetClass.id, studentProfile.id)) {
          enrolledCount += 1;
        }
      }
    }

    return {
      importedCount,
      enrolledCount,
      skippedCount,
      errors,
      createdStudents,
    };
  }

  private mapClassroomRow(row: any): Classroom {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      subject: row.subject,
      gradeLevel: row.grade_level,
      description: row.description || '',
      teacherId: row.teacher_id,
      teacherName: row.teacher_name || 'Giáo viên',
      studentCount: Number(row.student_count || 0),
      isLocked: Boolean(row.is_locked),
      activityCount: Number(row.activity_count || 0),
      createdAt: row.created_at,
    };
  }

  public listClassrooms(user: UserProfile): Classroom[] {
    if (user.role === 'ADMIN') {
      const rows = this.db
        .prepare(`
          SELECT c.*, u.full_name as teacher_name,
                 (SELECT COUNT(*) FROM classroom_members cm WHERE cm.classroom_id = c.id) as student_count,
                 (SELECT COUNT(*) FROM game_rooms gr WHERE gr.classroom_id = c.id) as activity_count
          FROM classrooms c
          LEFT JOIN users u ON u.id = c.teacher_id
          ORDER BY c.created_at DESC
        `)
        .all();
      return rows.map((r) => this.mapClassroomRow(r));
    }

    if (user.role === 'TEACHER') {
      const rows = this.db
        .prepare(`
          SELECT c.*, u.full_name as teacher_name,
                 (SELECT COUNT(*) FROM classroom_members cm WHERE cm.classroom_id = c.id) as student_count,
                 (SELECT COUNT(*) FROM game_rooms gr WHERE gr.classroom_id = c.id) as activity_count
          FROM classrooms c
          LEFT JOIN users u ON u.id = c.teacher_id
          WHERE c.teacher_id = ? OR c.teacher_id = 'usr_teacher_demo'
          ORDER BY c.created_at DESC
        `)
        .all(user.id);
      return rows.map((r) => this.mapClassroomRow(r));
    }

    const rows = this.db
      .prepare(`
        SELECT c.*, u.full_name as teacher_name,
               (SELECT COUNT(*) FROM classroom_members cm WHERE cm.classroom_id = c.id) as student_count,
               (SELECT COUNT(*) FROM game_rooms gr WHERE gr.classroom_id = c.id) as activity_count
        FROM classrooms c
        INNER JOIN classroom_members m ON m.classroom_id = c.id
        LEFT JOIN users u ON u.id = c.teacher_id
        WHERE m.student_id = ?
        ORDER BY c.created_at DESC
      `)
      .all(user.id);
    return rows.map((r) => this.mapClassroomRow(r));
  }

  public getClassroomByCode(code: string): Classroom | null {
    const row = this.db
      .prepare(`
        SELECT c.*, u.full_name as teacher_name,
               (SELECT COUNT(*) FROM classroom_members cm WHERE cm.classroom_id = c.id) as student_count,
               (SELECT COUNT(*) FROM game_rooms gr WHERE gr.classroom_id = c.id) as activity_count
        FROM classrooms c
        LEFT JOIN users u ON u.id = c.teacher_id
        WHERE UPPER(c.code) = UPPER(?)
      `)
      .get(code.trim());
    return row ? this.mapClassroomRow(row) : null;
  }

  public getClassroomById(id: string): Classroom | null {
    const row = this.db
      .prepare(`
        SELECT c.*, u.full_name as teacher_name,
               (SELECT COUNT(*) FROM classroom_members cm WHERE cm.classroom_id = c.id) as student_count,
               (SELECT COUNT(*) FROM game_rooms gr WHERE gr.classroom_id = c.id) as activity_count
        FROM classrooms c
        LEFT JOIN users u ON u.id = c.teacher_id
        WHERE c.id = ?
      `)
      .get(id);
    return row ? this.mapClassroomRow(row) : null;
  }

  public createClassroom(params: {
    name: string;
    subject: string;
    gradeLevel: string;
    description: string;
    teacherId: string;
    customCode?: string;
  }): Classroom {
    const id = `cls_${crypto.randomBytes(6).toString('hex')}`;
    const code =
      params.customCode && params.customCode.trim().length >= 4
        ? params.customCode.trim().toUpperCase()
        : `LP${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const now = new Date().toISOString();
    this.db
      .prepare(`
        INSERT INTO classrooms (id, code, name, subject, grade_level, description, teacher_id, is_locked, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
      `)
      .run(
        id,
        code,
        params.name.trim(),
        params.subject.trim(),
        params.gradeLevel.trim(),
        params.description.trim(),
        params.teacherId,
        now
      );
    return this.getClassroomById(id)!;
  }

  public updateClassroom(
    classroomId: string,
    updates: {
      name?: string;
      subject?: string;
      gradeLevel?: string;
      description?: string;
      isLocked?: boolean;
      regenerateCode?: boolean;
    }
  ): Classroom | null {
    const existing = this.getClassroomById(classroomId);
    if (!existing) return null;

    const nextName = updates.name?.trim() || existing.name;
    const nextSubject = updates.subject?.trim() || existing.subject;
    const nextGrade = updates.gradeLevel?.trim() || existing.gradeLevel;
    const nextDesc =
      updates.description !== undefined ? updates.description.trim() : existing.description;
    const nextLocked =
      updates.isLocked !== undefined ? (updates.isLocked ? 1 : 0) : existing.isLocked ? 1 : 0;
    const nextCode = updates.regenerateCode
      ? `LP${crypto.randomBytes(3).toString('hex').toUpperCase()}`
      : existing.code;

    this.db
      .prepare(`
        UPDATE classrooms
        SET name = ?, subject = ?, grade_level = ?, description = ?, is_locked = ?, code = ?
        WHERE id = ?
      `)
      .run(nextName, nextSubject, nextGrade, nextDesc, nextLocked, nextCode, classroomId);

    return this.getClassroomById(classroomId);
  }

  public isStudentInClassroom(classroomId: string, studentId: string): boolean {
    const row = this.db
      .prepare(
        'SELECT COUNT(*) as c FROM classroom_members WHERE classroom_id = ? AND student_id = ?'
      )
      .get(classroomId, studentId) as { c: number };
    return row.c > 0;
  }

  public joinClassroom(classroomId: string, studentId: string): boolean {
    const id = `cm_${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();
    const info = this.db
      .prepare(`
        INSERT OR IGNORE INTO classroom_members (id, classroom_id, student_id, joined_at)
        VALUES (?, ?, ?, ?)
      `)
      .run(id, classroomId, studentId, now);
    return info.changes > 0;
  }

  public removeStudentFromClassroom(classroomId: string, studentId: string): boolean {
    const info = this.db
      .prepare('DELETE FROM classroom_members WHERE classroom_id = ? AND student_id = ?')
      .run(classroomId, studentId);
    return info.changes > 0;
  }

  public listClassroomMembers(classroomId: string): ClassroomMember[] {
    const rows = this.db
      .prepare(`
        SELECT cm.id, cm.classroom_id, cm.student_id, cm.joined_at,
               u.full_name as student_name, u.email as student_email,
               u.username as student_username, u.school_name, u.is_locked
        FROM classroom_members cm
        INNER JOIN users u ON u.id = cm.student_id
        WHERE cm.classroom_id = ?
        ORDER BY cm.joined_at DESC
      `)
      .all(classroomId) as any[];

    return rows.map((r) => ({
      id: r.id,
      classroomId: r.classroom_id,
      studentId: r.student_id,
      studentName: r.student_name,
      studentEmail: r.student_email,
      studentUsername: r.student_username || r.student_email.split('@')[0],
      schoolName: r.school_name || '',
      isLocked: Boolean(r.is_locked),
      joinedAt: r.joined_at,
    }));
  }

  public static isArenaCompatibleType(qType: QuestionType): boolean {
    return (
      qType === 'SINGLE_CHOICE' ||
      qType === 'MULTIPLE_CHOICE' ||
      qType === 'TRUE_FALSE' ||
      qType === 'IMAGE_CHOICE' ||
      qType === 'IMAGE_RECOGNITION' ||
      qType === 'AUDIO_QUESTION' ||
      qType === 'VIDEO_QUESTION'
    );
  }

  public listCategories(): QuestionCategory[] {
    const rows = this.db
      .prepare(`
        SELECT qc.*, u.full_name as creator_name
        FROM question_categories qc
        LEFT JOIN users u ON u.id = qc.creator_id
        ORDER BY qc.education_level ASC, qc.grade_level ASC, qc.subject ASC, qc.topic ASC
      `)
      .all() as any[];

    return rows.map((r) => ({
      id: r.id,
      educationLevel: r.education_level || 'THPT',
      gradeLevel: r.grade_level || 'Khối 12',
      subject: r.subject || 'Tổng hợp',
      topic: r.topic || 'Chuyên đề chung',
      lesson: r.lesson || 'Bài học chuẩn',
      creatorId: r.creator_id,
      creatorName: r.creator_name || 'Giáo viên',
      createdAt: r.created_at,
    }));
  }

  public createCategory(params: {
    educationLevel: string;
    gradeLevel: string;
    subject: string;
    topic: string;
    lesson: string;
    creatorId: string;
  }): QuestionCategory {
    const id = `cat_${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();
    this.db
      .prepare(`
        INSERT INTO question_categories (id, education_level, grade_level, subject, topic, lesson, creator_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        params.educationLevel.trim() || 'THPT',
        params.gradeLevel.trim() || 'Khối 12',
        params.subject.trim() || 'Tổng hợp',
        params.topic.trim() || 'Chuyên đề chung',
        params.lesson.trim() || 'Bài học chuẩn',
        params.creatorId,
        now
      );
    const created = this.listCategories().find((c) => c.id === id);
    return (
      created || {
        id,
        educationLevel: params.educationLevel,
        gradeLevel: params.gradeLevel,
        subject: params.subject,
        topic: params.topic,
        lesson: params.lesson,
        creatorId: params.creatorId,
        creatorName: 'Giáo viên',
        createdAt: now,
      }
    );
  }

  public deleteCategory(id: string): boolean {
    const info = this.db.prepare('DELETE FROM question_categories WHERE id = ?').run(id);
    return info.changes > 0;
  }

  private mapQuestionSetRow(row: any): QuestionSet {
    let sharedWithIds: string[] = [];
    try {
      if (row.shared_with_json) {
        const parsed = JSON.parse(row.shared_with_json);
        if (Array.isArray(parsed)) {
          sharedWithIds = parsed.map((x) => String(x));
        }
      }
    } catch {
      // ignore
    }

    return {
      id: row.id,
      title: row.title,
      subject: row.subject,
      gradeLevel: row.grade_level,
      topic: row.topic || 'Chuyên đề chung',
      description: row.description || '',
      creatorId: row.creator_id,
      creatorName: row.creator_name || 'Giáo viên',
      isPublic: Boolean(row.is_public),
      sharedWithIds,
      defaultPoints: Number(row.default_points || 1000),
      defaultTimeLimitSec: Number(row.default_time_limit_sec || 20),
      questionCount: Number(row.question_count || 0),
      arenaSupportedCount: Number(row.arena_supported_count ?? row.question_count ?? 0),
      updatedAt: row.updated_at || row.created_at,
      createdAt: row.created_at,
    };
  }

  public listQuestionSets(user?: UserProfile): QuestionSet[] {
    const rows = this.db
      .prepare(`
        SELECT qs.*, u.full_name as creator_name,
               (SELECT COUNT(*) FROM questions q WHERE q.question_set_id = qs.id) as question_count,
               (SELECT COUNT(*) FROM questions q WHERE q.question_set_id = qs.id AND q.question_type IN ('SINGLE_CHOICE','MULTIPLE_CHOICE','TRUE_FALSE','IMAGE_CHOICE','IMAGE_RECOGNITION','AUDIO_QUESTION','VIDEO_QUESTION')) as arena_supported_count
        FROM question_sets qs
        LEFT JOIN users u ON u.id = qs.creator_id
        ORDER BY qs.created_at DESC
      `)
      .all() as any[];

    const mapped = rows.map((r) => this.mapQuestionSetRow(r));
    if (!user || user.role === 'ADMIN') {
      return mapped;
    }
    return mapped.filter(
      (s) =>
        s.isPublic ||
        s.creatorId === user.id ||
        (s.sharedWithIds && s.sharedWithIds.includes(user.id))
    );
  }

  public getQuestionSetById(id: string): QuestionSet | null {
    const row = this.db
      .prepare(`
        SELECT qs.*, u.full_name as creator_name,
               (SELECT COUNT(*) FROM questions q WHERE q.question_set_id = qs.id) as question_count,
               (SELECT COUNT(*) FROM questions q WHERE q.question_set_id = qs.id AND q.question_type IN ('SINGLE_CHOICE','MULTIPLE_CHOICE','TRUE_FALSE','IMAGE_CHOICE','IMAGE_RECOGNITION','AUDIO_QUESTION','VIDEO_QUESTION')) as arena_supported_count
        FROM question_sets qs
        LEFT JOIN users u ON u.id = qs.creator_id
        WHERE qs.id = ?
      `)
      .get(id);
    return row ? this.mapQuestionSetRow(row) : null;
  }

  public createQuestionSet(params: {
    title: string;
    subject: string;
    gradeLevel: string;
    topic?: string;
    description: string;
    creatorId: string;
    isPublic: boolean;
    sharedWithIds?: string[];
    defaultPoints?: number;
    defaultTimeLimitSec?: number;
  }): QuestionSet {
    const id = `qset_${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();
    this.db
      .prepare(`
        INSERT INTO question_sets (
          id, title, subject, grade_level, topic, description, creator_id, is_public,
          shared_with_json, default_points, default_time_limit_sec, updated_at, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        params.title.trim(),
        params.subject.trim(),
        params.gradeLevel.trim(),
        (params.topic || 'Chuyên đề chung').trim(),
        params.description.trim(),
        params.creatorId,
        params.isPublic ? 1 : 0,
        JSON.stringify(params.sharedWithIds || []),
        params.defaultPoints || 1000,
        params.defaultTimeLimitSec || 20,
        now,
        now
      );
    return this.getQuestionSetById(id)!;
  }

  public updateQuestionSet(
    id: string,
    updates: {
      title?: string;
      subject?: string;
      gradeLevel?: string;
      topic?: string;
      description?: string;
      isPublic?: boolean;
      sharedWithIds?: string[];
      defaultPoints?: number;
      defaultTimeLimitSec?: number;
    }
  ): QuestionSet | null {
    const existing = this.getQuestionSetById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const nextTitle = updates.title?.trim() || existing.title;
    const nextSubject = updates.subject?.trim() || existing.subject;
    const nextGrade = updates.gradeLevel?.trim() || existing.gradeLevel;
    const nextTopic = updates.topic?.trim() ?? (existing.topic || 'Chuyên đề chung');
    const nextDesc =
      updates.description !== undefined ? updates.description.trim() : existing.description;
    const nextPublic =
      updates.isPublic !== undefined ? (updates.isPublic ? 1 : 0) : existing.isPublic ? 1 : 0;
    const nextShared =
      updates.sharedWithIds !== undefined
        ? JSON.stringify(updates.sharedWithIds)
        : JSON.stringify(existing.sharedWithIds || []);
    const nextPoints = updates.defaultPoints || existing.defaultPoints || 1000;
    const nextTime = updates.defaultTimeLimitSec || existing.defaultTimeLimitSec || 20;

    this.db
      .prepare(`
        UPDATE question_sets
        SET title = ?, subject = ?, grade_level = ?, topic = ?, description = ?,
            is_public = ?, shared_with_json = ?, default_points = ?, default_time_limit_sec = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(
        nextTitle,
        nextSubject,
        nextGrade,
        nextTopic,
        nextDesc,
        nextPublic,
        nextShared,
        nextPoints,
        nextTime,
        now,
        id
      );

    return this.getQuestionSetById(id);
  }

  public duplicateQuestionSet(id: string, actor: UserProfile): QuestionSet | null {
    const sourceSet = this.getQuestionSetById(id);
    if (!sourceSet) return null;
    const sourceQuestions = this.getQuestionsForSet(id);

    const clonedSet = this.createQuestionSet({
      title: `${sourceSet.title} (Bản sao)`,
      subject: sourceSet.subject,
      gradeLevel: sourceSet.gradeLevel,
      topic: sourceSet.topic,
      description: sourceSet.description,
      creatorId: actor.id,
      isPublic: sourceSet.isPublic,
      defaultPoints: sourceSet.defaultPoints,
      defaultTimeLimitSec: sourceSet.defaultTimeLimitSec,
    });

    for (const q of sourceQuestions) {
      this.addQuestionToSet({
        questionSetId: clonedSet.id,
        questionType: q.questionType,
        prompt: q.prompt,
        imageUrl: q.imageUrl,
        audioUrl: q.audioUrl,
        videoUrl: q.videoUrl,
        options: q.options,
        correctIndex: q.correctIndex,
        correctIndices: q.correctIndices,
        correctAnswerText: q.correctAnswerText,
        matchingPairs: q.matchingPairs,
        orderingItems: q.orderingItems,
        timeLimitSec: q.timeLimitSec,
        points: q.points,
        explanation: q.explanation,
        educationLevel: q.educationLevel,
        gradeLevel: q.gradeLevel,
        subject: q.subject,
        topic: q.topic,
        lesson: q.lesson,
        cognitiveLevel: q.cognitiveLevel,
        difficulty: q.difficulty,
        usageStatus: q.usageStatus,
        creatorId: actor.id,
        creatorName: actor.fullName,
      });
    }

    return this.getQuestionSetById(clonedSet.id);
  }

  public deleteQuestionSet(id: string): boolean {
    const info = this.db.prepare('DELETE FROM question_sets WHERE id = ?').run(id);
    return info.changes > 0;
  }

  private mapQuestionRow(r: any): FullQuestion {
    let parsedOptions: string[] = ['A', 'B', 'C', 'D'];
    try {
      const arr = JSON.parse(r.options_json);
      if (Array.isArray(arr)) {
        parsedOptions = arr.map((item) => String(item));
      }
    } catch {
      // fallback
    }
    let parsedCorrectIndices: number[] = [Number(r.correct_index || 0)];
    try {
      if (r.correct_indices_json) {
        const cArr = JSON.parse(r.correct_indices_json);
        if (Array.isArray(cArr) && cArr.length > 0) {
          parsedCorrectIndices = cArr.map((n) => Number(n));
        }
      }
    } catch {
      // fallback
    }
    let parsedMatchingPairs: MatchingPairItem[] = [];
    try {
      if (r.matching_pairs_json) {
        const mArr = JSON.parse(r.matching_pairs_json);
        if (Array.isArray(mArr)) {
          parsedMatchingPairs = mArr
            .filter((item) => item && typeof item.left === 'string')
            .map((item) => ({ left: String(item.left), right: String(item.right || '') }));
        }
      }
    } catch {
      // fallback
    }
    let parsedOrderingItems: string[] = [];
    try {
      if (r.ordering_items_json) {
        const oArr = JSON.parse(r.ordering_items_json);
        if (Array.isArray(oArr)) {
          parsedOrderingItems = oArr.map((item) => String(item));
        }
      }
    } catch {
      // fallback
    }

    const qType: QuestionType = (r.question_type as QuestionType) || 'SINGLE_CHOICE';
    const isArenaSupported = SqliteDataRepository.isArenaCompatibleType(qType);
    const requiresManualGrading = qType === 'ESSAY';

    return {
      id: r.id,
      questionCode: r.question_code || `QB-${r.id.slice(-4).toUpperCase()}`,
      questionSetId: r.question_set_id,
      orderIndex: Number(r.order_index),
      questionType: qType,
      prompt: r.prompt,
      imageUrl: r.image_url || undefined,
      audioUrl: r.audio_url || undefined,
      videoUrl: r.video_url || undefined,
      options: parsedOptions,
      correctIndex: Number(r.correct_index || 0),
      correctIndices: parsedCorrectIndices,
      correctAnswerText: r.correct_answer_text || undefined,
      matchingPairs: parsedMatchingPairs.length > 0 ? parsedMatchingPairs : undefined,
      orderingItems: parsedOrderingItems.length > 0 ? parsedOrderingItems : undefined,
      timeLimitSec: Number(r.time_limit_sec || 20),
      points: Number(r.points || 1000),
      explanation: r.explanation || '',
      educationLevel: r.education_level || 'THPT',
      gradeLevel: r.grade_level || 'Khối 12',
      subject: r.subject || 'Tổng hợp',
      topic: r.topic || 'Chuyên đề chung',
      lesson: r.lesson || 'Bài học chuẩn',
      cognitiveLevel: (r.cognitive_level as CognitiveLevel) || 'UNDERSTAND',
      difficulty: (r.difficulty as DifficultyLevel) || 'MEDIUM',
      usageStatus: (r.usage_status as QuestionUsageStatus) || 'ACTIVE',
      creatorId: r.creator_id || 'usr_teacher_demo',
      creatorName: r.creator_name || 'ThS. Nguyễn Minh Hoàng',
      createdAt: r.created_at || new Date().toISOString(),
      updatedAt: r.updated_at || r.created_at || new Date().toISOString(),
      isArenaSupported,
      requiresManualGrading,
    };
  }

  public getQuestionsForSet(questionSetId: string): FullQuestion[] {
    const rows = this.db
      .prepare('SELECT * FROM questions WHERE question_set_id = ? ORDER BY order_index ASC')
      .all(questionSetId) as any[];

    return rows.map((r) => this.mapQuestionRow(r));
  }

  public getQuestionById(questionId: string): FullQuestion | null {
    const row = this.db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
    return row ? this.mapQuestionRow(row) : null;
  }

  public listAllQuestions(filters?: {
    search?: string;
    questionSetId?: string;
    educationLevel?: string;
    gradeLevel?: string;
    subject?: string;
    topic?: string;
    lesson?: string;
    questionType?: QuestionType;
    cognitiveLevel?: CognitiveLevel;
    difficulty?: DifficultyLevel;
    usageStatus?: QuestionUsageStatus;
    creatorId?: string;
    arenaOnly?: boolean;
  }): FullQuestion[] {
    const clauses: string[] = ['1=1'];
    const params: any[] = [];

    if (filters?.questionSetId) {
      clauses.push('question_set_id = ?');
      params.push(filters.questionSetId);
    }
    if (filters?.educationLevel && filters.educationLevel !== 'ALL') {
      clauses.push('LOWER(education_level) = LOWER(?)');
      params.push(filters.educationLevel.trim());
    }
    if (filters?.gradeLevel && filters.gradeLevel !== 'ALL') {
      clauses.push('LOWER(grade_level) LIKE LOWER(?)');
      params.push(`%${filters.gradeLevel.trim()}%`);
    }
    if (filters?.subject && filters.subject !== 'ALL') {
      clauses.push('LOWER(subject) = LOWER(?)');
      params.push(filters.subject.trim());
    }
    if (filters?.topic && filters.topic !== 'ALL') {
      clauses.push('LOWER(topic) LIKE LOWER(?)');
      params.push(`%${filters.topic.trim()}%`);
    }
    if (filters?.lesson && filters.lesson !== 'ALL') {
      clauses.push('LOWER(lesson) LIKE LOWER(?)');
      params.push(`%${filters.lesson.trim()}%`);
    }
    if (filters?.questionType) {
      clauses.push('question_type = ?');
      params.push(filters.questionType);
    }
    if (filters?.cognitiveLevel) {
      clauses.push('cognitive_level = ?');
      params.push(filters.cognitiveLevel);
    }
    if (filters?.difficulty) {
      clauses.push('difficulty = ?');
      params.push(filters.difficulty);
    }
    if (filters?.usageStatus) {
      clauses.push('usage_status = ?');
      params.push(filters.usageStatus);
    }
    if (filters?.creatorId) {
      clauses.push('creator_id = ?');
      params.push(filters.creatorId);
    }
    if (filters?.search && filters.search.trim()) {
      const q = `%${filters.search.trim()}%`;
      clauses.push(
        '(LOWER(prompt) LIKE LOWER(?) OR LOWER(question_code) LIKE LOWER(?) OR LOWER(topic) LIKE LOWER(?) OR LOWER(explanation) LIKE LOWER(?))'
      );
      params.push(q, q, q, q);
    }

    const rows = this.db
      .prepare(
        `SELECT * FROM questions WHERE ${clauses.join(' AND ')} ORDER BY question_set_id ASC, order_index ASC`
      )
      .all(...params) as any[];

    const mapped = rows.map((r) => this.mapQuestionRow(r));
    if (filters?.arenaOnly) {
      return mapped.filter((q) => q.isArenaSupported);
    }
    return mapped;
  }

  public addQuestionToSet(params: {
    questionSetId: string;
    questionCode?: string;
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
    timeLimitSec: number;
    points: number;
    explanation: string;
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
  }): FullQuestion {
    const id = `q_${crypto.randomBytes(6).toString('hex')}`;
    const countRow = this.db
      .prepare('SELECT COUNT(*) as cnt FROM questions WHERE question_set_id = ?')
      .get(params.questionSetId) as { cnt: number };
    const totalCountRow = this.db.prepare('SELECT COUNT(*) as cnt FROM questions').get() as {
      cnt: number;
    };

    const qSet = this.getQuestionSetById(params.questionSetId);
    const orderIndex = countRow.cnt;
    const qType: QuestionType = params.questionType || 'SINGLE_CHOICE';
    const now = new Date().toISOString();

    let cleanedOptions = params.options.map((o) => String(o).trim()).filter(Boolean);
    if (qType === 'TRUE_FALSE') {
      cleanedOptions = [params.options[0]?.trim() || 'Đúng', params.options[1]?.trim() || 'Sai'];
    } else if (qType === 'ORDERING' && params.orderingItems && params.orderingItems.length >= 2) {
      cleanedOptions = params.orderingItems.map((o) => String(o).trim());
    } else if (qType === 'MATCHING' && params.matchingPairs && params.matchingPairs.length >= 2) {
      cleanedOptions = params.matchingPairs.map((m) => `${m.left} -> ${m.right}`);
    } else if (cleanedOptions.length < 2) {
      cleanedOptions = [
        params.correctAnswerText?.trim() || 'Đáp án chuẩn',
        'Phương án nhiễu',
      ];
    }

    const safeCorrectIndex = Math.min(3, Math.max(0, Number(params.correctIndex) || 0));
    const correctIndices =
      Array.isArray(params.correctIndices) && params.correctIndices.length > 0
        ? params.correctIndices
        : [safeCorrectIndex];

    const questionCode =
      params.questionCode?.trim() ||
      `QB-${String(totalCountRow.cnt + 101).padStart(4, '0')}`;

    const educationLevel = params.educationLevel?.trim() || 'THPT';
    const gradeLevel = params.gradeLevel?.trim() || qSet?.gradeLevel || 'Khối 12';
    const subject = params.subject?.trim() || qSet?.subject || 'Tổng hợp';
    const topic = params.topic?.trim() || qSet?.topic || 'Chuyên đề chung';
    const lesson = params.lesson?.trim() || 'Bài học chuẩn';
    const cognitiveLevel: CognitiveLevel = params.cognitiveLevel || 'UNDERSTAND';
    const difficulty: DifficultyLevel = params.difficulty || 'MEDIUM';
    const usageStatus: QuestionUsageStatus = params.usageStatus || 'ACTIVE';
    const creatorId = params.creatorId || qSet?.creatorId || 'usr_teacher_demo';
    const creatorName = params.creatorName || qSet?.creatorName || 'Giáo viên';

    const tx = this.db.transaction(() => {
      this.insertNormalizedQuestion(params.questionSetId, id, orderIndex, {
        questionType: qType,
        prompt: params.prompt.trim(),
        imageUrl: params.imageUrl?.trim() || '',
        audioUrl: params.audioUrl?.trim() || '',
        videoUrl: params.videoUrl?.trim() || '',
        options: cleanedOptions,
        correctIndex: safeCorrectIndex,
        correctIndices,
        timeLimitSec: params.timeLimitSec,
        points: params.points,
        explanation: params.explanation.trim(),
      });

      this.db
        .prepare(`
          UPDATE questions
          SET question_code = ?,
              education_level = ?,
              grade_level = ?,
              subject = ?,
              topic = ?,
              lesson = ?,
              cognitive_level = ?,
              difficulty = ?,
              usage_status = ?,
              creator_id = ?,
              creator_name = ?,
              correct_answer_text = ?,
              matching_pairs_json = ?,
              ordering_items_json = ?,
              created_at = ?,
              updated_at = ?
          WHERE id = ?
        `)
        .run(
          questionCode,
          educationLevel,
          gradeLevel,
          subject,
          topic,
          lesson,
          cognitiveLevel,
          difficulty,
          usageStatus,
          creatorId,
          creatorName,
          params.correctAnswerText?.trim() || '',
          JSON.stringify(params.matchingPairs || []),
          JSON.stringify(params.orderingItems || []),
          now,
          now,
          id
        );
    });
    tx();

    return this.getQuestionById(id)!;
  }

  public updateQuestion(
    questionId: string,
    updates: {
      questionType?: QuestionType;
      prompt?: string;
      imageUrl?: string | null;
      audioUrl?: string | null;
      videoUrl?: string | null;
      options?: string[];
      correctIndex?: number;
      correctIndices?: number[];
      correctAnswerText?: string;
      matchingPairs?: MatchingPairItem[];
      orderingItems?: string[];
      timeLimitSec?: number;
      points?: number;
      explanation?: string;
      educationLevel?: string;
      gradeLevel?: string;
      subject?: string;
      topic?: string;
      lesson?: string;
      cognitiveLevel?: CognitiveLevel;
      difficulty?: DifficultyLevel;
      usageStatus?: QuestionUsageStatus;
    }
  ): FullQuestion | null {
    const existing = this.getQuestionById(questionId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const nextType = updates.questionType || existing.questionType || 'SINGLE_CHOICE';
    const nextPrompt = updates.prompt?.trim() || existing.prompt;
    const nextImage =
      updates.imageUrl !== undefined ? (updates.imageUrl || '').trim() : existing.imageUrl || '';
    const nextAudio =
      updates.audioUrl !== undefined ? (updates.audioUrl || '').trim() : existing.audioUrl || '';
    const nextVideo =
      updates.videoUrl !== undefined ? (updates.videoUrl || '').trim() : existing.videoUrl || '';

    let nextOptions =
      updates.options && updates.options.length > 0
        ? updates.options.map((o) => String(o).trim()).filter(Boolean)
        : existing.options;
    if (nextType === 'TRUE_FALSE') {
      nextOptions = [nextOptions[0] || 'Đúng', nextOptions[1] || 'Sai'];
    } else if (nextOptions.length < 2) {
      nextOptions = [updates.correctAnswerText || existing.correctAnswerText || 'Đáp án', 'Khác'];
    }

    const nextCorrectIndex = Math.min(
      3,
      Math.max(
        0,
        updates.correctIndex !== undefined ? Number(updates.correctIndex) : existing.correctIndex
      )
    );
    const nextCorrectIndices =
      updates.correctIndices && updates.correctIndices.length > 0
        ? updates.correctIndices
        : existing.correctIndices || [nextCorrectIndex];

    const nextAnswerText =
      updates.correctAnswerText !== undefined
        ? updates.correctAnswerText.trim()
        : existing.correctAnswerText || '';
    const nextMatching =
      updates.matchingPairs !== undefined
        ? updates.matchingPairs
        : existing.matchingPairs || [];
    const nextOrdering =
      updates.orderingItems !== undefined
        ? updates.orderingItems
        : existing.orderingItems || [];

    const nextTime =
      updates.timeLimitSec !== undefined
        ? Math.min(300, Math.max(5, Number(updates.timeLimitSec)))
        : existing.timeLimitSec;
    const nextPoints =
      updates.points !== undefined
        ? Math.min(10000, Math.max(50, Number(updates.points)))
        : existing.points;
    const nextExplanation =
      updates.explanation !== undefined ? updates.explanation.trim() : existing.explanation;

    const nextEdu = updates.educationLevel?.trim() || existing.educationLevel || 'THPT';
    const nextGrade = updates.gradeLevel?.trim() || existing.gradeLevel || 'Khối 12';
    const nextSubj = updates.subject?.trim() || existing.subject || 'Tổng hợp';
    const nextTopic = updates.topic?.trim() || existing.topic || 'Chuyên đề chung';
    const nextLesson = updates.lesson?.trim() || existing.lesson || 'Bài học chuẩn';
    const nextCog = updates.cognitiveLevel || existing.cognitiveLevel || 'UNDERSTAND';
    const nextDiff = updates.difficulty || existing.difficulty || 'MEDIUM';
    const nextStatus = updates.usageStatus || existing.usageStatus || 'ACTIVE';

    this.db
      .prepare(`
        UPDATE questions
        SET question_type = ?,
            prompt = ?,
            image_url = ?,
            audio_url = ?,
            video_url = ?,
            options_json = ?,
            correct_index = ?,
            correct_indices_json = ?,
            correct_answer_text = ?,
            matching_pairs_json = ?,
            ordering_items_json = ?,
            time_limit_sec = ?,
            points = ?,
            explanation = ?,
            education_level = ?,
            grade_level = ?,
            subject = ?,
            topic = ?,
            lesson = ?,
            cognitive_level = ?,
            difficulty = ?,
            usage_status = ?,
            updated_at = ?
        WHERE id = ?
      `)
      .run(
        nextType,
        nextPrompt,
        nextImage,
        nextAudio,
        nextVideo,
        JSON.stringify(nextOptions),
        nextCorrectIndex,
        JSON.stringify(nextCorrectIndices),
        nextAnswerText,
        JSON.stringify(nextMatching),
        JSON.stringify(nextOrdering),
        nextTime,
        nextPoints,
        nextExplanation,
        nextEdu,
        nextGrade,
        nextSubj,
        nextTopic,
        nextLesson,
        nextCog,
        nextDiff,
        nextStatus,
        now,
        questionId
      );

    return this.getQuestionById(questionId);
  }

  public duplicateQuestion(
    questionId: string,
    targetSetId: string,
    actor: UserProfile
  ): FullQuestion | null {
    const source = this.getQuestionById(questionId);
    if (!source) return null;
    const destSetId = targetSetId || source.questionSetId;

    return this.addQuestionToSet({
      questionSetId: destSetId,
      questionType: source.questionType,
      prompt: `${source.prompt}${destSetId === source.questionSetId ? ' (Bản sao)' : ''}`,
      imageUrl: source.imageUrl,
      audioUrl: source.audioUrl,
      videoUrl: source.videoUrl,
      options: source.options,
      correctIndex: source.correctIndex,
      correctIndices: source.correctIndices,
      correctAnswerText: source.correctAnswerText,
      matchingPairs: source.matchingPairs,
      orderingItems: source.orderingItems,
      timeLimitSec: source.timeLimitSec,
      points: source.points,
      explanation: source.explanation,
      educationLevel: source.educationLevel,
      gradeLevel: source.gradeLevel,
      subject: source.subject,
      topic: source.topic,
      lesson: source.lesson,
      cognitiveLevel: source.cognitiveLevel,
      difficulty: source.difficulty,
      usageStatus: source.usageStatus,
      creatorId: actor.id,
      creatorName: actor.fullName,
    });
  }

  public reorderQuestionsInSet(questionSetId: string, orderedQuestionIds: string[]): FullQuestion[] {
    const existing = this.getQuestionsForSet(questionSetId);
    const idSet = new Set(existing.map((q) => q.id));
    const validOrder = orderedQuestionIds.filter((id) => idSet.has(id));
    for (const q of existing) {
      if (!validOrder.includes(q.id)) {
        validOrder.push(q.id);
      }
    }

    const tx = this.db.transaction(() => {
      const updateOrder = this.db.prepare(
        'UPDATE questions SET order_index = ? WHERE id = ? AND question_set_id = ?'
      );
      const updateQuizLink = this.db.prepare(
        'UPDATE quiz_questions SET order_index = ? WHERE quiz_id = ? AND question_id = ?'
      );
      validOrder.forEach((qid, idx) => {
        updateOrder.run(idx, qid, questionSetId);
        updateQuizLink.run(idx, questionSetId, qid);
      });
    });
    tx();

    return this.getQuestionsForSet(questionSetId);
  }

  public removeQuestionFromSet(questionSetId: string, questionId: string): boolean {
    const q = this.getQuestionById(questionId);
    if (!q) return false;

    // Ensure an archive/library set exists so removing a question from a quiz preserves the original question in the teacher's bank
    let archiveSet = this.listQuestionSets().find((s) => s.id === 'qset_general_archive');
    if (!archiveSet) {
      const now = new Date().toISOString();
      this.db
        .prepare(`
          INSERT OR IGNORE INTO question_sets
          (id, title, subject, grade_level, topic, description, creator_id, is_public, created_at, updated_at)
          VALUES ('qset_general_archive', 'Kho Lưu Trữ Câu Hỏi Gốc (Chưa gắn bộ đề)', 'Tổng hợp', 'Đa khối', 'Kho lưu trữ', 'Lưu giữ các câu hỏi đã gỡ khỏi bộ đề thi để tái sử dụng.', 'usr_teacher_demo', 1, ?, ?)
        `)
        .run(now, now);
    }

    if (questionSetId === 'qset_general_archive') {
      return this.deleteQuestion(questionId);
    }

    const info = this.db
      .prepare("UPDATE questions SET question_set_id = 'qset_general_archive' WHERE id = ? AND question_set_id = ?")
      .run(questionId, questionSetId);
    this.db
      .prepare('DELETE FROM quiz_questions WHERE quiz_id = ? AND question_id = ?')
      .run(questionSetId, questionId);

    return info.changes > 0;
  }

  public deleteQuestion(questionId: string): boolean {
    const info = this.db.prepare('DELETE FROM questions WHERE id = ?').run(questionId);
    return info.changes > 0;
  }

  public autoSelectQuestionsByMatrix(params: {
    subject?: string;
    gradeLevel?: string;
    topic?: string;
    arenaOnly?: boolean;
    matrix: {
      rememberCount?: number;
      understandCount?: number;
      applyCount?: number;
      highApplyCount?: number;
      easyCount?: number;
      mediumCount?: number;
      hardCount?: number;
      veryHardCount?: number;
    };
  }): FullQuestion[] {
    const pool = this.listAllQuestions({
      subject: params.subject,
      gradeLevel: params.gradeLevel,
      topic: params.topic,
      arenaOnly: params.arenaOnly,
    });

    const selected: FullQuestion[] = [];
    const usedIds = new Set<string>();
    const usedPrompts = new Set<string>();

    const pickFromBucket = (predicate: (q: FullQuestion) => boolean, count: number) => {
      if (!count || count <= 0) return;
      const candidates = pool.filter(
        (q) =>
          !usedIds.has(q.id) &&
          !usedPrompts.has(q.prompt.trim().toLowerCase()) &&
          predicate(q)
      );
      for (let i = 0; i < Math.min(count, candidates.length); i++) {
        const chosen = candidates[i];
        selected.push(chosen);
        usedIds.add(chosen.id);
        usedPrompts.add(chosen.prompt.trim().toLowerCase());
      }
    };

    const m = params.matrix || {};
    const hasCognitiveTargets =
      (m.rememberCount || 0) +
        (m.understandCount || 0) +
        (m.applyCount || 0) +
        (m.highApplyCount || 0) >
      0;

    if (hasCognitiveTargets) {
      pickFromBucket((q) => q.cognitiveLevel === 'REMEMBER', m.rememberCount || 0);
      pickFromBucket((q) => q.cognitiveLevel === 'UNDERSTAND', m.understandCount || 0);
      pickFromBucket((q) => q.cognitiveLevel === 'APPLY', m.applyCount || 0);
      pickFromBucket((q) => q.cognitiveLevel === 'HIGH_APPLY', m.highApplyCount || 0);
    }

    const hasDifficultyTargets =
      (m.easyCount || 0) + (m.mediumCount || 0) + (m.hardCount || 0) + (m.veryHardCount || 0) > 0;

    if (hasDifficultyTargets) {
      pickFromBucket((q) => q.difficulty === 'EASY', m.easyCount || 0);
      pickFromBucket((q) => q.difficulty === 'MEDIUM', m.mediumCount || 0);
      pickFromBucket((q) => q.difficulty === 'HARD', m.hardCount || 0);
      pickFromBucket((q) => q.difficulty === 'VERY_HARD', m.veryHardCount || 0);
    }

    // If requested total exceeds strict bucket matches, fill remaining from available pool
    const requestedTotal =
      (m.rememberCount || 0) +
        (m.understandCount || 0) +
        (m.applyCount || 0) +
        (m.highApplyCount || 0) ||
      (m.easyCount || 0) + (m.mediumCount || 0) + (m.hardCount || 0) + (m.veryHardCount || 0);

    if (selected.length < requestedTotal) {
      pickFromBucket(() => true, requestedTotal - selected.length);
    }

    return selected;
  }

  public analyzeQuestionBankQuality(params?: {
    questionSetId?: string;
    topic?: string;
  }): QuestionQualityIssue[] {
    const questions = this.listAllQuestions({
      questionSetId: params?.questionSetId,
      topic: params?.topic,
    });

    const issues: QuestionQualityIssue[] = [];
    const seenPrompts = new Map<string, FullQuestion>();

    for (const q of questions) {
      const normalizedPrompt = q.prompt.trim().toLowerCase().replace(/\s+/g, ' ');

      // 1. Duplicate question detection
      if (seenPrompts.has(normalizedPrompt)) {
        const first = seenPrompts.get(normalizedPrompt)!;
        issues.push({
          questionId: q.id,
          questionCode: q.questionCode,
          prompt: q.prompt,
          severity: 'WARNING',
          issueType: 'DUPLICATE_PROMPT',
          message: `Nội dung câu hỏi bị trùng lặp với câu hỏi mã ${first.questionCode || first.id}.`,
        });
      } else {
        seenPrompts.set(normalizedPrompt, q);
      }

      // 2. Missing options or duplicate options
      const isChoiceType =
        q.questionType === 'SINGLE_CHOICE' ||
        q.questionType === 'MULTIPLE_CHOICE' ||
        q.questionType === 'TRUE_FALSE' ||
        q.questionType === 'IMAGE_CHOICE';

      if (isChoiceType) {
        const nonEmptyOpts = q.options.map((o) => o.trim()).filter(Boolean);
        const minExpected = q.questionType === 'TRUE_FALSE' ? 2 : 2;
        if (nonEmptyOpts.length < minExpected) {
          issues.push({
            questionId: q.id,
            questionCode: q.questionCode,
            prompt: q.prompt,
            severity: 'ERROR',
            issueType: 'MISSING_OPTIONS',
            message: `Câu hỏi trắc nghiệm bị thiếu phương án trả lời (hiện có ${nonEmptyOpts.length} phương án).`,
          });
        }
        const uniqueOpts = new Set(nonEmptyOpts.map((o) => o.toLowerCase()));
        if (uniqueOpts.size < nonEmptyOpts.length) {
          issues.push({
            questionId: q.id,
            questionCode: q.questionCode,
            prompt: q.prompt,
            severity: 'WARNING',
            issueType: 'AMBIGUOUS_WORDING',
            message: 'Các phương án trả lời có nội dung trùng lặp nhau gây nhiễu không hợp lý.',
          });
        }

        // 3. Invalid or out-of-range correct answer
        const indices = q.correctIndices && q.correctIndices.length > 0 ? q.correctIndices : [q.correctIndex];
        if (indices.some((idx) => idx < 0 || idx >= q.options.length)) {
          issues.push({
            questionId: q.id,
            questionCode: q.questionCode,
            prompt: q.prompt,
            severity: 'ERROR',
            issueType: 'INVALID_CORRECT_ANSWER',
            message: 'Chỉ số đáp án đúng nằm ngoài danh sách các phương án trả lời hiện có.',
          });
        }
        if (q.questionType === 'SINGLE_CHOICE' && indices.length > 1) {
          issues.push({
            questionId: q.id,
            questionCode: q.questionCode,
            prompt: q.prompt,
            severity: 'WARNING',
            issueType: 'INVALID_CORRECT_ANSWER',
            message: 'Câu hỏi trắc nghiệm 1 đáp án nhưng đang cấu hình nhiều đáp án đúng.',
          });
        }
      }

      // 4. Ambiguous / unclear wording or missing explanation
      if (q.prompt.trim().length < 15) {
        issues.push({
          questionId: q.id,
          questionCode: q.questionCode,
          prompt: q.prompt,
          severity: 'WARNING',
          issueType: 'AMBIGUOUS_WORDING',
          message: 'Nội dung câu hỏi quá ngắn (< 15 ký tự), có thể diễn đạt chưa rõ ràng.',
          suggestedFix: {
            prompt: `${q.prompt.trim()} (Hãy chọn phương án chính xác nhất dưới đây)`,
          },
        });
      }

      if (!q.explanation || q.explanation.trim().length < 8) {
        issues.push({
          questionId: q.id,
          questionCode: q.questionCode,
          prompt: q.prompt,
          severity: 'WARNING',
          issueType: 'SPELLING_OR_CLARITY',
          message: 'Câu hỏi chưa có lời giải thích chi tiết giúp học sinh ôn tập sau khi chốt đáp án.',
          suggestedFix: {
            explanation: `Đáp án đúng là "${q.options[q.correctIndex] || q.correctAnswerText || 'A'}". Hãy đối chiếu với kiến thức trọng tâm của bài học "${q.lesson || q.topic}".`,
          },
        });
      }

      // 5. Difficulty vs Cognitive Level consistency check
      if (
        (q.cognitiveLevel === 'REMEMBER' && q.difficulty === 'VERY_HARD') ||
        (q.cognitiveLevel === 'HIGH_APPLY' && q.difficulty === 'EASY')
      ) {
        issues.push({
          questionId: q.id,
          questionCode: q.questionCode,
          prompt: q.prompt,
          severity: 'WARNING',
          issueType: 'DIFFICULTY_MISMATCH',
          message: `Mức độ nhận thức (${q.cognitiveLevel}) chưa tương ứng với Độ khó (${q.difficulty}).`,
          suggestedFix: {
            difficulty: q.cognitiveLevel === 'REMEMBER' ? 'EASY' : 'HARD',
          },
        });
      }
    }

    return issues;
  }

  public upsertGameRoomRecord(params: {
    roomId: string;
    sessionId: string;
    code: string;
    title: string;
    quizId: string;
    classroomId: string | null;
    hostId: string;
    status: RoomStatus;
    maxParticipants: number;
    isTestMode: boolean;
    totalQuestions: number;
    snapshotJson?: string;
  }): void {
    const now = new Date().toISOString();
    const tx = this.db.transaction(() => {
      this.db
        .prepare(`
          INSERT INTO game_rooms
          (id, code, title, quiz_id, classroom_id, host_id, status, max_participants, is_test_mode, snapshot_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            code = excluded.code,
            title = excluded.title,
            status = excluded.status,
            max_participants = excluded.max_participants,
            snapshot_json = CASE WHEN excluded.snapshot_json != '' THEN excluded.snapshot_json ELSE game_rooms.snapshot_json END
        `)
        .run(
          params.roomId,
          params.code,
          params.title,
          params.quizId,
          params.classroomId || null,
          params.hostId,
          params.status,
          params.maxParticipants,
          params.isTestMode ? 1 : 0,
          params.snapshotJson || '',
          now
        );

      this.db
        .prepare(`
          INSERT INTO game_sessions
          (id, room_id, quiz_id, started_at, finished_at, total_questions, participant_count, status)
          VALUES (
            ?, ?, ?, ?, ?, ?,
            (SELECT COUNT(*) FROM game_participants WHERE room_id = ?),
            ?
          )
          ON CONFLICT(id) DO UPDATE SET
            finished_at = excluded.finished_at,
            total_questions = excluded.total_questions,
            participant_count = (SELECT COUNT(*) FROM game_participants WHERE room_id = excluded.room_id),
            status = excluded.status
        `)
        .run(
          params.sessionId,
          params.roomId,
          params.quizId,
          now,
          params.status === 'FINISHED' ? now : null,
          params.totalQuestions,
          params.roomId,
          params.status
        );
    });
    tx();
  }

  public loadRecoverableRoomSnapshots(): string[] {
    const rows = this.db
      .prepare(
        "SELECT snapshot_json FROM game_rooms WHERE status != 'FINISHED' AND snapshot_json != '' ORDER BY created_at DESC LIMIT 25"
      )
      .all() as Array<{ snapshot_json: string }>;
    return rows.map((r) => r.snapshot_json).filter(Boolean);
  }

  public upsertGameParticipantRecord(params: {
    roomId: string;
    userId: string;
    displayName: string;
    role: UserRole;
    isOnline: boolean;
  }): void {
    const now = new Date().toISOString();
    this.db
      .prepare(`
        INSERT INTO game_participants (id, room_id, user_id, display_name, role, is_online, joined_at, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(room_id, user_id) DO UPDATE SET
          display_name = excluded.display_name,
          is_online = excluded.is_online,
          last_seen_at = excluded.last_seen_at
      `)
      .run(
        `gp_${params.roomId}_${params.userId}`,
        params.roomId,
        params.userId,
        params.displayName,
        params.role,
        params.isOnline ? 1 : 0,
        now,
        now
      );
  }

  public recordPlayerAnswer(params: {
    sessionId: string;
    roomId: string;
    userId: string;
    questionId: string;
    questionIndex: number;
    selectedIndex: number | null;
    isCorrect: boolean;
    earnedPoints: number;
    responseTimeMs: number;
  }): boolean {
    const now = new Date().toISOString();
    const info = this.db
      .prepare(`
        INSERT OR IGNORE INTO player_answers
        (id, session_id, room_id, user_id, question_id, question_index, selected_option_index, is_correct, earned_points, response_time_ms, answered_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        `pa_${crypto.randomBytes(8).toString('hex')}`,
        params.sessionId,
        params.roomId,
        params.userId,
        params.questionId,
        params.questionIndex,
        params.selectedIndex,
        params.isCorrect ? 1 : 0,
        params.earnedPoints,
        params.responseTimeMs,
        now
      );
    return info.changes > 0;
  }

  public saveCompletedMatch(params: {
    roomId: string;
    sessionId?: string;
    roomCode: string;
    roomTitle: string;
    questionSetId: string;
    questionSetTitle: string;
    hostId: string;
    hostName: string;
    totalQuestions: number;
    participants: PersistedMatchParticipant[];
    submissions: PersistedSubmission[];
  }): void {
    const now = new Date().toISOString();
    const sorted = [...params.participants].sort((a, b) => b.score - a.score);
    const sessionId = params.sessionId || `sess_${params.roomId}`;

    const tx = this.db.transaction(() => {
      this.db
        .prepare(`
          INSERT OR REPLACE INTO completed_matches
          (id, room_code, room_title, question_set_id, question_set_title, host_id, host_name, total_questions, participant_count, finished_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          params.roomId,
          params.roomCode,
          params.roomTitle,
          params.questionSetId,
          params.questionSetTitle,
          params.hostId,
          params.hostName,
          params.totalQuestions,
          sorted.length,
          now
        );

      const insertRes = this.db.prepare(`
        INSERT INTO match_results (id, match_id, user_id, display_name, role, score, correct_count, rank_position)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertScore = this.db.prepare(`
        INSERT OR REPLACE INTO scores
        (id, session_id, room_id, user_id, total_score, correct_count, max_streak, accuracy_percent, rank_position, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      sorted.forEach((p, idx) => {
        const rank = idx + 1;
        const accuracy =
          params.totalQuestions > 0
            ? Math.round((p.correctCount / params.totalQuestions) * 100)
            : 0;

        insertRes.run(
          `mr_${crypto.randomBytes(6).toString('hex')}`,
          params.roomId,
          p.userId,
          p.displayName,
          p.role,
          p.score,
          p.correctCount,
          rank
        );

        insertScore.run(
          `sc_${sessionId}_${p.userId}`,
          sessionId,
          params.roomId,
          p.userId,
          p.score,
          p.correctCount,
          p.maxStreak || 0,
          accuracy,
          rank,
          now
        );
      });

      const insertSub = this.db.prepare(`
        INSERT INTO match_submissions
        (id, match_id, user_id, question_index, prompt, options_json, selected_index, correct_index, is_correct, earned_points, response_time_ms, explanation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      params.submissions.forEach((s) => {
        insertSub.run(
          `ms_${crypto.randomBytes(6).toString('hex')}`,
          params.roomId,
          s.userId,
          s.questionIndex,
          s.prompt,
          JSON.stringify(s.options),
          s.selectedIndex,
          s.correctIndex,
          s.isCorrect ? 1 : 0,
          s.earnedPoints,
          s.responseTimeMs,
          s.explanation
        );
      });
    });

    tx();
    this.refreshMaterializedLeaderboard();
  }

  private refreshMaterializedLeaderboard(): void {
    const now = new Date().toISOString();
    const rows = this.db
      .prepare(`
        SELECT
          mr.user_id,
          COALESCE(u.full_name, mr.display_name) as full_name,
          COALESCE(u.school_name, 'Đấu trường Quizzi') as school_name,
          COALESCE(u.role, mr.role) as role,
          SUM(mr.score) as total_score,
          COUNT(mr.id) as matches_played,
          SUM(mr.correct_count) as total_correct,
          SUM(cm.total_questions) as total_answered
        FROM match_results mr
        INNER JOIN completed_matches cm ON cm.id = mr.match_id
        LEFT JOIN users u ON u.id = mr.user_id
        GROUP BY mr.user_id
      `)
      .all() as any[];

    const upsertLb = this.db.prepare(`
      INSERT OR REPLACE INTO leaderboards
      (user_id, full_name, school_name, role, total_score, matches_played, total_correct, total_answered, accuracy_percent, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction(() => {
      for (const r of rows) {
        const totalCorrect = Number(r.total_correct || 0);
        const totalAnswered = Number(r.total_answered || 1);
        const acc = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
        upsertLb.run(
          r.user_id,
          r.full_name,
          r.school_name,
          r.role || 'STUDENT',
          Number(r.total_score || 0),
          Number(r.matches_played || 0),
          totalCorrect,
          totalAnswered,
          acc,
          now
        );
      }
    });
    tx();
  }

  public listMatchHistory(
    userId?: string,
    page = 1,
    limit = 30
  ): { history: MatchHistoryRecord[]; pagination: PaginationMetadata } {
    const total = (
      this.db.prepare('SELECT COUNT(*) as c FROM completed_matches').get() as { c: number }
    ).c;
    const offset = Math.max(0, (page - 1) * limit);
    const rows = this.db
      .prepare('SELECT * FROM completed_matches ORDER BY finished_at DESC LIMIT ? OFFSET ?')
      .all(limit, offset) as any[];

    const history = rows.map((r) => {
      let userScore: number | undefined;
      let userRank: number | undefined;
      let userCorrectCount: number | undefined;

      if (userId) {
        const resRow = this.db
          .prepare(
            'SELECT score, rank_position, correct_count FROM match_results WHERE match_id = ? AND user_id = ?'
          )
          .get(r.id, userId) as any;
        if (resRow) {
          userScore = Number(resRow.score);
          userRank = Number(resRow.rank_position);
          userCorrectCount = Number(resRow.correct_count);
        }
      }

      return {
        id: r.id,
        roomCode: r.room_code,
        roomTitle: r.room_title,
        questionSetTitle: r.question_set_title,
        hostName: r.host_name,
        finishedAt: r.finished_at,
        participantCount: Number(r.participant_count),
        totalQuestions: Number(r.total_questions),
        userScore,
        userRank,
        userCorrectCount,
      };
    });

    return {
      history,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  public getMatchSubmissionDetails(matchId: string, userId: string): MatchSubmissionDetail[] {
    const rows = this.db
      .prepare(`
        SELECT * FROM match_submissions
        WHERE match_id = ? AND user_id = ?
        ORDER BY question_index ASC
      `)
      .all(matchId, userId) as any[];

    return rows.map((r) => {
      let options: [string, string, string, string] = ['A', 'B', 'C', 'D'];
      try {
        const parsed = JSON.parse(r.options_json);
        if (Array.isArray(parsed) && parsed.length === 4) {
          options = [
            String(parsed[0]),
            String(parsed[1]),
            String(parsed[2]),
            String(parsed[3]),
          ];
        }
      } catch {
        // default
      }
      return {
        questionIndex: Number(r.question_index),
        prompt: r.prompt,
        options,
        selectedIndex: r.selected_index === null ? null : Number(r.selected_index),
        correctIndex: Number(r.correct_index),
        isCorrect: Boolean(r.is_correct),
        earnedPoints: Number(r.earned_points),
        responseTimeMs: Number(r.response_time_ms),
        explanation: r.explanation || '',
      };
    });
  }

  public getLeaderboard(limit = 30): LeaderboardEntry[] {
    const rows = this.db
      .prepare('SELECT * FROM leaderboards ORDER BY total_score DESC LIMIT ?')
      .all(limit) as any[];

    return rows.map((r) => ({
      userId: r.user_id,
      fullName: r.full_name,
      schoolName: r.school_name,
      role: (r.role || 'STUDENT') as UserRole,
      totalScore: Number(r.total_score || 0),
      matchesPlayed: Number(r.matches_played || 0),
      totalCorrect: Number(r.total_correct || 0),
      totalAnswered: Number(r.total_answered || 0),
      accuracyPercent: Number(r.accuracy_percent || 0),
    }));
  }

  public getRoleDashboardSummary(
    user: UserProfile,
    activeLiveRoomsCount: number
  ): RoleDashboardSummary {
    if (user.role === 'ADMIN') {
      const totalUsers = (
        this.db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }
      ).c;
      const teacherCount = (
        this.db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'TEACHER'").get() as {
          c: number;
        }
      ).c;
      const studentCount = (
        this.db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'STUDENT'").get() as {
          c: number;
        }
      ).c;
      const classroomCount = (
        this.db.prepare('SELECT COUNT(*) as c FROM classrooms').get() as { c: number }
      ).c;
      const completedRooms = (
        this.db.prepare('SELECT COUNT(*) as c FROM completed_matches').get() as { c: number }
      ).c;
      const totalParticipations = (
        this.db.prepare('SELECT COUNT(*) as c FROM match_results').get() as { c: number }
      ).c;

      return {
        role: 'ADMIN',
        adminMetrics: {
          totalUsers,
          teacherCount,
          studentCount,
          classroomCount,
          totalRoomsCount: completedRooms + activeLiveRoomsCount,
          totalParticipations,
          recentActivities: this.listActivityLogs(1, 8).logs,
        },
      };
    }

    if (user.role === 'TEACHER') {
      const teacherClasses = this.listClassrooms(user);
      const totalStudentsInClasses = teacherClasses.reduce(
        (acc, c) => acc + c.studentCount,
        0
      );
      const qSetCount = (
        this.db
          .prepare(
            "SELECT COUNT(*) as c FROM question_sets WHERE creator_id = ? OR creator_id = 'usr_teacher_demo'"
          )
          .get(user.id) as { c: number }
      ).c;
      const hostedRoomCount = (
        this.db
          .prepare(
            "SELECT COUNT(*) as c FROM completed_matches WHERE host_id = ? OR host_id = 'usr_teacher_demo'"
          )
          .get(user.id) as { c: number }
      ).c;

      return {
        role: 'TEACHER',
        teacherMetrics: {
          managedClassCount: teacherClasses.length,
          totalStudentsInClasses,
          questionSetCount: qSetCount,
          quizCount: qSetCount,
          hostedRoomCount: hostedRoomCount + activeLiveRoomsCount,
          recentClassResults: this.listMatchHistory(user.id, 1, 6).history,
        },
      };
    }

    // STUDENT Role Dashboard
    const studentClasses = this.listClassrooms(user);
    const lbEntries = this.getLeaderboard(50);
    const myIndex = lbEntries.findIndex((e) => e.userId === user.id);
    const myEntry = myIndex >= 0 ? lbEntries[myIndex] : null;

    return {
      role: 'STUDENT',
      studentMetrics: {
        joinedClassCount: studentClasses.length,
        activeRoomCount: activeLiveRoomsCount,
        personalTotalScore: myEntry?.totalScore || 0,
        matchesPlayed: myEntry?.matchesPlayed || 0,
        accuracyPercent: myEntry?.accuracyPercent || 0,
        personalRank: myIndex >= 0 ? myIndex + 1 : null,
        recentMatches: this.listMatchHistory(user.id, 1, 6).history,
        topLeaderboard: lbEntries.slice(0, 5),
      },
    };
  }

  public logActivity(params: {
    actorId: string;
    actorName: string;
    actorRole: UserRole;
    action: string;
    module: string;
    targetId?: string;
    details?: string;
  }): void {
    const id = `act_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();
    this.db
      .prepare(`
        INSERT INTO activity_logs
        (id, actor_id, actor_name, actor_role, action, module, target_id, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        params.actorId,
        params.actorName,
        params.actorRole,
        params.action,
        params.module,
        params.targetId || '',
        params.details || '',
        now
      );
  }

  public listActivityLogs(
    page = 1,
    limit = 20
  ): { logs: ActivityLogRecord[]; pagination: PaginationMetadata } {
    const total = (
      this.db.prepare('SELECT COUNT(*) as c FROM activity_logs').get() as { c: number }
    ).c;
    const offset = Math.max(0, (page - 1) * limit);
    const rows = this.db
      .prepare('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(limit, offset) as any[];

    return {
      logs: rows.map((r) => ({
        id: r.id,
        actorId: r.actor_id,
        actorName: r.actor_name,
        actorRole: r.actor_role as UserRole,
        action: r.action,
        module: r.module,
        targetId: r.target_id,
        details: r.details,
        createdAt: r.created_at,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  public getReportSummary(): ReportSummary {
    const totalSessions = (
      this.db.prepare('SELECT COUNT(*) as c FROM completed_matches').get() as { c: number }
    ).c;
    const subStats = this.db
      .prepare(`
        SELECT
          COUNT(*) as total_answers,
          AVG(CASE WHEN is_correct = 1 THEN 100.0 ELSE 0.0 END) as avg_acc,
          AVG(response_time_ms) as avg_time
        FROM match_submissions
      `)
      .get() as any;

    const subjectRows = this.db
      .prepare(`
        SELECT
          qs.subject,
          COUNT(DISTINCT qs.id) as quiz_count,
          COUNT(q.id) as question_count
        FROM question_sets qs
        LEFT JOIN questions q ON q.question_set_id = qs.id
        GROUP BY qs.subject
        ORDER BY quiz_count DESC
      `)
      .all() as any[];

    const recentLogs = this.listActivityLogs(1, 10).logs;

    return {
      totalSessions,
      totalPlayerAnswers: Number(subStats?.total_answers || 0),
      averageAccuracyPercent: Math.round(Number(subStats?.avg_acc || 85)),
      averageResponseTimeMs: Math.round(Number(subStats?.avg_time || 4200)),
      subjectBreakdown: subjectRows.map((r) => ({
        subject: r.subject,
        quizCount: Number(r.quiz_count || 0),
        questionCount: Number(r.question_count || 0),
      })),
      recentActivityLogs: recentLogs,
    };
  }

  public getSystemCounts() {
    const users = (this.db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
    const sets = (
      this.db.prepare('SELECT COUNT(*) as c FROM question_sets').get() as { c: number }
    ).c;
    const questions = (
      this.db.prepare('SELECT COUNT(*) as c FROM questions').get() as { c: number }
    ).c;
    const matches = (
      this.db.prepare('SELECT COUNT(*) as c FROM completed_matches').get() as { c: number }
    ).c;
    const logs = (
      this.db.prepare('SELECT COUNT(*) as c FROM activity_logs').get() as { c: number }
    ).c;

    return {
      totalUsers: users,
      totalQuestionSets: sets,
      totalQuestions: questions,
      totalMatchesCompleted: matches,
      totalActivityLogs: logs,
    };
  }
}
