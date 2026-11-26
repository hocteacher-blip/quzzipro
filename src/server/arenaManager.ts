import crypto from 'crypto';
import type { WebSocket } from 'ws';
import type {
  ArenaTeam,
  FullQuestion,
  GameMode,
  LiveRoomState,
  PublicQuestion,
  RealtimeEventType,
  RoomAccessPolicy,
  RoomAnswerDistribution,
  RoomParticipant,
  RoomStatus,
  TeamPlayFormat,
  UserProfile,
} from '../types/arena.ts';
import type { IDataRepository, PersistedSubmission } from './repository.ts';
import { ServerScoringEngine } from './modules/scoring/scoringEngine.ts';
import { ApiValidationError } from './middleware/validation.ts';

interface PendingRoundAnswer {
  userId: string;
  teamId?: string | null;
  selectedIndex: number;
  selectedIndices: number[];
  isCorrect: boolean;
  earnedPoints: number;
  responseTimeMs: number;
}

interface InternalParticipant extends RoomParticipant {
  maxStreak: number;
  answeredCount: number;
  totalResponseTimeMs: number;
  avgResponseTimeMs: number;
}

interface InternalRoom {
  id: string;
  sessionId: string;
  code: string;
  title: string;
  description: string;
  questionSetId: string;
  questionSetTitle: string;
  classroomId: string | null;
  hostId: string;
  hostName: string;
  isTestMode: boolean;
  gameMode: GameMode;
  accessPolicy: RoomAccessPolicy;
  isPublic: boolean;
  isJoinLocked: boolean;
  timeLimitOverrideSec: number | null;
  pointsOverride: number | null;
  maxParticipants: number;
  isTeamMode: boolean;
  teamPlayFormat: TeamPlayFormat;
  teams: Map<string, ArenaTeam>;
  revealAnswersPolicy: 'IMMEDIATE' | 'END_OF_MATCH';
  publicLeaderboardPolicy: boolean;
  allowRejoinPolicy: boolean;
  maxAttemptsPerPlayer: number;
  status: RoomStatus;
  currentQuestionIndex: number;
  questions: FullQuestion[];
  questionStartedAt: number | null;
  questionEndsAt: number | null;
  pausedRemainingMs: number | null;
  lastEventType: RealtimeEventType;
  participants: Map<string, InternalParticipant>;
  currentRoundSubmissions: Map<string, PendingRoundAnswer>;
  allSubmissions: PersistedSubmission[];
  timerHandle: NodeJS.Timeout | null;
  broadcastDebounceHandle: NodeJS.Timeout | null;
  persistedToDb: boolean;
}

interface ClientConnection {
  ws: WebSocket;
  userId: string;
  roomCode: string | null;
  isAlive: boolean;
}

export class ArenaRealtimeManager {
  private roomsByCode = new Map<string, InternalRoom>();
  private clients = new Set<ClientConnection>();
  private repo: IDataRepository;
  private heartbeatInterval: NodeJS.Timeout;

  public static readonly MAX_CONCURRENT_PER_ROOM = 100;

  constructor(repo: IDataRepository) {
    this.repo = repo;
    this.restoreRecoverableRoomsFromDb();

    // Heartbeat ping/pong every 25 seconds to detect disconnected clients & support 100+ sockets cleanly
    this.heartbeatInterval = setInterval(() => {
      for (const conn of this.clients) {
        if (!conn.isAlive) {
          conn.ws.terminate();
          this.handleClientDisconnect(conn);
          continue;
        }
        conn.isAlive = false;
        try {
          conn.ws.ping();
        } catch {
          // ignore
        }
      }
    }, 25000);
    this.heartbeatInterval.unref?.();
  }

  /**
   * Section XI: Server Restart Recovery
   * Rehydrates non-finished rooms stored in SQLite snapshot_json so ongoing matches survive server restarts.
   */
  private restoreRecoverableRoomsFromDb(): void {
    try {
      const snapshots = this.repo.loadRecoverableRoomSnapshots();
      for (const raw of snapshots) {
        try {
          const parsed = JSON.parse(raw);
          if (!parsed || !parsed.code || parsed.status === 'FINISHED') continue;

          const participantsMap = new Map<string, InternalParticipant>();
          if (Array.isArray(parsed.participants)) {
            for (const p of parsed.participants) {
              participantsMap.set(p.userId, {
                ...p,
                isOnline: false,
              });
            }
          }

          const submissionsMap = new Map<string, PendingRoundAnswer>();
          if (Array.isArray(parsed.currentRoundSubmissions)) {
            for (const sub of parsed.currentRoundSubmissions) {
              submissionsMap.set(sub.userId, sub);
            }
          }

          const teamsMap = new Map<string, ArenaTeam>();
          if (Array.isArray(parsed.teams)) {
            for (const t of parsed.teams) {
              teamsMap.set(t.id, t);
            }
          }

          const recoveredStatus: RoomStatus =
            parsed.status === 'QUESTION_ACTIVE' ? 'PAUSED' : parsed.status;
          const pausedRem =
            parsed.status === 'QUESTION_ACTIVE' && parsed.questionEndsAt
              ? Math.max(5000, parsed.questionEndsAt - Date.now())
              : parsed.pausedRemainingMs || null;

          const room: InternalRoom = {
            id: parsed.id,
            sessionId: parsed.sessionId,
            code: parsed.code,
            title: parsed.title,
            description: parsed.description || '',
            questionSetId: parsed.questionSetId,
            questionSetTitle: parsed.questionSetTitle,
            classroomId: parsed.classroomId || null,
            hostId: parsed.hostId,
            hostName: parsed.hostName,
            isTestMode: Boolean(parsed.isTestMode),
            gameMode: parsed.gameMode || 'SPEED_PRECISION',
            accessPolicy: parsed.accessPolicy || 'ANY_AUTHENTICATED',
            isPublic: parsed.isPublic !== false,
            isJoinLocked: Boolean(parsed.isJoinLocked),
            timeLimitOverrideSec: parsed.timeLimitOverrideSec || null,
            pointsOverride: parsed.pointsOverride || null,
            maxParticipants:
              parsed.maxParticipants || ArenaRealtimeManager.MAX_CONCURRENT_PER_ROOM,
            isTeamMode: Boolean(parsed.isTeamMode),
            teamPlayFormat: parsed.teamPlayFormat || 'ALL_MEMBERS_SCORE',
            teams: teamsMap,
            revealAnswersPolicy: parsed.revealAnswersPolicy || 'IMMEDIATE',
            publicLeaderboardPolicy: parsed.publicLeaderboardPolicy !== false,
            allowRejoinPolicy: parsed.allowRejoinPolicy !== false,
            maxAttemptsPerPlayer: Number(parsed.maxAttemptsPerPlayer || 1),
            status: recoveredStatus,
            currentQuestionIndex: Number(parsed.currentQuestionIndex || 0),
            questions: Array.isArray(parsed.questions) ? parsed.questions : [],
            questionStartedAt: parsed.questionStartedAt || null,
            questionEndsAt: recoveredStatus === 'PAUSED' ? null : parsed.questionEndsAt || null,
            pausedRemainingMs: pausedRem,
            lastEventType: 'room:updated',
            participants: participantsMap,
            currentRoundSubmissions: submissionsMap,
            allSubmissions: Array.isArray(parsed.allSubmissions) ? parsed.allSubmissions : [],
            timerHandle: null,
            broadcastDebounceHandle: null,
            persistedToDb: false,
          };

          if (room.questions.length > 0) {
            this.roomsByCode.set(room.code, room);
          }
        } catch {
          // ignore malformed snapshot
        }
      }
    } catch {
      // ignore initial recovery failure
    }
  }

  private persistRoomSnapshot(room: InternalRoom): void {
    try {
      const serializable = {
        id: room.id,
        sessionId: room.sessionId,
        code: room.code,
        title: room.title,
        description: room.description,
        questionSetId: room.questionSetId,
        questionSetTitle: room.questionSetTitle,
        classroomId: room.classroomId,
        hostId: room.hostId,
        hostName: room.hostName,
        isTestMode: room.isTestMode,
        gameMode: room.gameMode,
        accessPolicy: room.accessPolicy,
        isPublic: room.isPublic,
        isJoinLocked: room.isJoinLocked,
        timeLimitOverrideSec: room.timeLimitOverrideSec,
        pointsOverride: room.pointsOverride,
        maxParticipants: room.maxParticipants,
        isTeamMode: room.isTeamMode,
        teamPlayFormat: room.teamPlayFormat,
        teams: Array.from(room.teams.values()),
        revealAnswersPolicy: room.revealAnswersPolicy,
        publicLeaderboardPolicy: room.publicLeaderboardPolicy,
        allowRejoinPolicy: room.allowRejoinPolicy,
        maxAttemptsPerPlayer: room.maxAttemptsPerPlayer,
        status: room.status,
        currentQuestionIndex: room.currentQuestionIndex,
        questions: room.questions,
        questionStartedAt: room.questionStartedAt,
        questionEndsAt: room.questionEndsAt,
        pausedRemainingMs: room.pausedRemainingMs,
        participants: Array.from(room.participants.values()),
        currentRoundSubmissions: Array.from(room.currentRoundSubmissions.values()),
        allSubmissions: room.allSubmissions,
      };

      this.repo.upsertGameRoomRecord({
        roomId: room.id,
        sessionId: room.sessionId,
        code: room.code,
        title: room.title,
        quizId: room.questionSetId,
        classroomId: room.classroomId,
        hostId: room.hostId,
        status: room.status,
        maxParticipants: room.maxParticipants,
        isTestMode: room.isTestMode,
        totalQuestions: room.questions.length,
        snapshotJson: JSON.stringify(serializable),
      });
    } catch {
      // ignore transient snapshot error
    }
  }

  public getActiveRoomCount(): number {
    return this.roomsByCode.size;
  }

  public getActiveClientCount(): number {
    return this.clients.size;
  }

  public listActivePublicRooms(): Array<{
    id: string;
    code: string;
    title: string;
    description: string;
    questionSetTitle: string;
    hostName: string;
    status: RoomStatus;
    gameMode: GameMode;
    accessPolicy: RoomAccessPolicy;
    isPublic: boolean;
    isJoinLocked: boolean;
    participantCount: number;
    maxParticipants: number;
    isTestMode: boolean;
  }> {
    const list: Array<{
      id: string;
      code: string;
      title: string;
      description: string;
      questionSetTitle: string;
      hostName: string;
      status: RoomStatus;
      gameMode: GameMode;
      accessPolicy: RoomAccessPolicy;
      isPublic: boolean;
      isJoinLocked: boolean;
      participantCount: number;
      maxParticipants: number;
      isTestMode: boolean;
    }> = [];

    for (const room of this.roomsByCode.values()) {
      if (room.status !== 'FINISHED' && room.isPublic) {
        list.push({
          id: room.id,
          code: room.code,
          title: room.title,
          description: room.description,
          questionSetTitle: room.questionSetTitle,
          hostName: room.hostName,
          status: room.status,
          gameMode: room.gameMode,
          accessPolicy: room.accessPolicy,
          isPublic: room.isPublic,
          isJoinLocked: room.isJoinLocked,
          participantCount: room.participants.size,
          maxParticipants: room.maxParticipants,
          isTestMode: room.isTestMode,
        });
      }
    }
    return list;
  }

  /**
   * Cryptographically secure 6-digit PIN generation
   */
  private generateUniquePin(): string {
    for (let attempt = 0; attempt < 30; attempt++) {
      const pin = String(crypto.randomInt(100000, 999999));
      if (!this.roomsByCode.has(pin)) {
        return pin;
      }
    }
    return String(Date.now()).slice(-6);
  }

  private static readonly DEFAULT_TEAM_PALETTE = [
    { name: 'Đội Phượng Hoàng Đỏ', colorName: 'Đỏ', colorHex: '#dc2626' },
    { name: 'Đội Thanh Long Xanh', colorName: 'Xanh Dương', colorHex: '#2563eb' },
    { name: 'Đội Bạch Hổ Vàng', colorName: 'Vàng Hổ Phách', colorHex: '#d97706' },
    { name: 'Đội Huyền Vũ Lục', colorName: 'Xanh Ngọc', colorHex: '#059669' },
    { name: 'Đội Kỳ Lân Tím', colorName: 'Tím', colorHex: '#7c3aed' },
    { name: 'Đội Đại Bàng Cam', colorName: 'Cam', colorHex: '#ea580c' },
  ];

  public createRoom(params: {
    host: UserProfile;
    questionSetId: string;
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
    revealAnswersPolicy?: 'IMMEDIATE' | 'END_OF_MATCH';
    publicLeaderboardPolicy?: boolean;
    allowRejoinPolicy?: boolean;
    maxAttemptsPerPlayer?: number;
  }): LiveRoomState {
    const qSet = this.repo.getQuestionSetById(params.questionSetId);
    if (!qSet) {
      throw new ApiValidationError('Không tìm thấy bộ câu hỏi được chọn.', 404);
    }
    const rawQuestions = this.repo.getQuestionsForSet(params.questionSetId);
    const arenaEligibleQuestions = rawQuestions.filter(
      (q) =>
        q.isArenaSupported !== false &&
        Array.isArray(q.options) &&
        q.options.length >= 2 &&
        q.usageStatus !== 'ARCHIVED'
    );
    if (arenaEligibleQuestions.length === 0) {
      throw new ApiValidationError(
        'Bộ câu hỏi này chưa có câu hỏi nào tương thích với Đấu trường trực tiếp (Trắc nghiệm / Đúng-Sai / Đa phương tiện). Vui lòng thêm câu hỏi hỗ trợ Đấu trường trước khi mở phòng.',
        400
      );
    }

    // Apply question limit, timeLimitOverrideSec, and pointsOverride
    const limit =
      typeof params.questionLimit === 'number' && params.questionLimit > 0
        ? Math.min(arenaEligibleQuestions.length, Math.max(1, Math.floor(params.questionLimit)))
        : arenaEligibleQuestions.length;

    const timeOverride =
      typeof params.timeLimitOverrideSec === 'number' && params.timeLimitOverrideSec >= 5
        ? Math.min(180, Math.floor(params.timeLimitOverrideSec))
        : null;

    const ptsOverride =
      typeof params.pointsOverride === 'number' && params.pointsOverride >= 100
        ? Math.min(10000, Math.floor(params.pointsOverride))
        : null;

    // Immutable deep snapshot so editing the Question Bank during or after a match never mutates room state
    const lockedQuestions: FullQuestion[] = arenaEligibleQuestions
      .slice(0, limit)
      .map((q, idx) => ({
        ...q,
        options: [...q.options],
        correctIndices: Array.isArray(q.correctIndices) ? [...q.correctIndices] : [q.correctIndex],
        orderIndex: idx,
        timeLimitSec: timeOverride ?? q.timeLimitSec,
        points: ptsOverride ?? q.points,
      }));

    const code = this.generateUniquePin();
    const roomId = `room_${crypto.randomBytes(6).toString('hex')}`;
    const sessionId = `sess_${crypto.randomBytes(6).toString('hex')}`;
    const isTestMode = Boolean(params.isTestMode);
    const isTeamMode = Boolean(params.isTeamMode);
    const defaultTitle = isTestMode
      ? `Lượt chơi thử nghiệm: ${qSet.title}`
      : isTeamMode
        ? `Đấu đội: ${qSet.title}`
        : `Đấu trường: ${qSet.title}`;

    const maxP =
      typeof params.maxParticipants === 'number' && params.maxParticipants >= 1
        ? Math.min(
            ArenaRealtimeManager.MAX_CONCURRENT_PER_ROOM,
            Math.max(1, Math.floor(params.maxParticipants))
          )
        : ArenaRealtimeManager.MAX_CONCURRENT_PER_ROOM;

    const gameMode: GameMode =
      params.gameMode === 'STANDARD' || params.gameMode === 'HIGH_STAKES'
        ? params.gameMode
        : 'SPEED_PRECISION';

    const accessPolicy: RoomAccessPolicy =
      params.accessPolicy === 'CLASSROOM_ONLY' || params.accessPolicy === 'ALLOW_GUEST'
        ? params.accessPolicy
        : 'ANY_AUTHENTICATED';

    const teamPlayFormat: TeamPlayFormat =
      params.teamPlayFormat === 'CAPTAIN_REPRESENTATIVE' ||
      params.teamPlayFormat === 'TURN_BY_TURN' ||
      params.teamPlayFormat === 'TEAM_CONSENSUS'
        ? params.teamPlayFormat
        : 'ALL_MEMBERS_SCORE';

    const teamsMap = new Map<string, ArenaTeam>();
    if (isTeamMode) {
      const initialTeamsCount = Math.min(6, Math.max(2, Number(params.teamCount) || 2));
      for (let i = 0; i < initialTeamsCount; i++) {
        const preset = ArenaRealtimeManager.DEFAULT_TEAM_PALETTE[i];
        const tId = `team_${i + 1}_${crypto.randomBytes(3).toString('hex')}`;
        teamsMap.set(tId, {
          id: tId,
          name: preset.name,
          colorHex: preset.colorHex,
          colorName: preset.colorName,
          captainUserId: null,
          activeTurnUserId: null,
          totalScore: 0,
          memberCount: 0,
          correctCount: 0,
          memberUserIds: [],
        });
      }
    }

    const room: InternalRoom = {
      id: roomId,
      sessionId,
      code,
      title: (params.title || defaultTitle).trim(),
      description: (params.description || qSet.description || '').trim(),
      questionSetId: qSet.id,
      questionSetTitle: qSet.title,
      classroomId: params.classroomId || null,
      hostId: params.host.id,
      hostName: params.host.fullName,
      isTestMode,
      gameMode,
      accessPolicy,
      isPublic: params.isPublic !== false,
      isJoinLocked: false,
      timeLimitOverrideSec: timeOverride,
      pointsOverride: ptsOverride,
      maxParticipants: maxP,
      isTeamMode,
      teamPlayFormat,
      teams: teamsMap,
      revealAnswersPolicy: params.revealAnswersPolicy === 'END_OF_MATCH' ? 'END_OF_MATCH' : 'IMMEDIATE',
      publicLeaderboardPolicy: params.publicLeaderboardPolicy !== false,
      allowRejoinPolicy: params.allowRejoinPolicy !== false,
      maxAttemptsPerPlayer: Math.max(1, Number(params.maxAttemptsPerPlayer) || 1),
      status: 'LOBBY',
      currentQuestionIndex: 0,
      questions: lockedQuestions,
      questionStartedAt: null,
      questionEndsAt: null,
      pausedRemainingMs: null,
      lastEventType: 'room:updated',
      participants: new Map(),
      currentRoundSubmissions: new Map(),
      allSubmissions: [],
      timerHandle: null,
      broadcastDebounceHandle: null,
      persistedToDb: false,
    };

    this.roomsByCode.set(code, room);
    this.persistRoomSnapshot(room);
    this.upsertParticipant(room, params.host);
    this.persistRoomSnapshot(room);

    this.repo.logActivity({
      actorId: params.host.id,
      actorName: params.host.fullName,
      actorRole: params.host.role,
      action: isTestMode ? 'TEST_ROOM_CREATED' : isTeamMode ? 'TEAM_ROOM_CREATED' : 'GAME_ROOM_CREATED',
      module: 'Rooms',
      targetId: room.code,
      details: `Tạo phòng "${room.title}" (PIN: ${room.code}, Chế độ: ${room.gameMode}, Đấu đội: ${isTeamMode})`,
    });

    return this.toPublicState(room);
  }

  private syncTeamMemberships(room: InternalRoom): void {
    if (!room.isTeamMode) return;
    for (const t of room.teams.values()) {
      t.memberUserIds = [];
      t.memberCount = 0;
    }
    for (const p of room.participants.values()) {
      if (p.teamId && room.teams.has(p.teamId)) {
        const team = room.teams.get(p.teamId)!;
        team.memberUserIds.push(p.userId);
        team.memberCount = team.memberUserIds.length;
        p.teamName = team.name;
        p.teamColorHex = team.colorHex;
        if (!team.captainUserId) {
          team.captainUserId = p.userId;
        }
        p.isTeamCaptain = team.captainUserId === p.userId;
        if (!team.activeTurnUserId && team.memberUserIds.length > 0) {
          team.activeTurnUserId = team.memberUserIds[0];
        }
      } else {
        p.teamId = null;
        p.teamName = null;
        p.teamColorHex = null;
        p.isTeamCaptain = false;
      }
    }
  }

  public configureRoomTeams(
    code: string,
    actor: UserProfile,
    actionPayload: {
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
  ): LiveRoomState {
    const room = this.roomsByCode.get(code.trim());
    if (!room) {
      throw new ApiValidationError('Không tìm thấy phòng thi đấu.', 404);
    }
    this.assertCanControlRoom(room, actor);
    if (room.status !== 'LOBBY') {
      throw new ApiValidationError('Chỉ có thể thay đổi cấu hình đội trước khi trận đấu bắt đầu.', 400);
    }

    room.isTeamMode = true;
    if (room.teams.size === 0) {
      for (let i = 0; i < 2; i++) {
        const preset = ArenaRealtimeManager.DEFAULT_TEAM_PALETTE[i];
        const tId = `team_${i + 1}_${crypto.randomBytes(3).toString('hex')}`;
        room.teams.set(tId, {
          id: tId,
          name: preset.name,
          colorHex: preset.colorHex,
          colorName: preset.colorName,
          captainUserId: null,
          activeTurnUserId: null,
          totalScore: 0,
          memberCount: 0,
          correctCount: 0,
          memberUserIds: [],
        });
      }
    }

    const { action } = actionPayload;
    if (action === 'CREATE_TEAM') {
      if (room.teams.size >= 8) {
        throw new ApiValidationError('Tối đa 8 đội trong một phòng thi đấu.', 400);
      }
      const preset =
        ArenaRealtimeManager.DEFAULT_TEAM_PALETTE[
          room.teams.size % ArenaRealtimeManager.DEFAULT_TEAM_PALETTE.length
        ];
      const tId = `team_${room.teams.size + 1}_${crypto.randomBytes(3).toString('hex')}`;
      room.teams.set(tId, {
        id: tId,
        name: (actionPayload.teamName || preset.name).trim(),
        colorHex: actionPayload.colorHex || preset.colorHex,
        colorName: actionPayload.colorName || preset.colorName,
        captainUserId: null,
        activeTurnUserId: null,
        totalScore: 0,
        memberCount: 0,
        correctCount: 0,
        memberUserIds: [],
      });
    } else if (action === 'RENAME_TEAM' && actionPayload.teamId) {
      const team = room.teams.get(actionPayload.teamId);
      if (!team) throw new ApiValidationError('Không tìm thấy đội.', 404);
      if (actionPayload.teamName?.trim()) team.name = actionPayload.teamName.trim();
      if (actionPayload.colorHex?.trim()) team.colorHex = actionPayload.colorHex.trim();
      if (actionPayload.colorName?.trim()) team.colorName = actionPayload.colorName.trim();
    } else if (action === 'ASSIGN_MEMBER' && actionPayload.targetUserId && actionPayload.teamId) {
      const p = room.participants.get(actionPayload.targetUserId);
      const team = room.teams.get(actionPayload.teamId);
      if (!p || !team) {
        throw new ApiValidationError('Không tìm thấy thành viên hoặc đội đích.', 404);
      }
      p.teamId = team.id;
    } else if (action === 'SET_CAPTAIN' && actionPayload.targetUserId && actionPayload.teamId) {
      const team = room.teams.get(actionPayload.teamId);
      const p = room.participants.get(actionPayload.targetUserId);
      if (!team || !p) throw new ApiValidationError('Không tìm thấy đội hoặc thành viên.', 404);
      p.teamId = team.id;
      team.captainUserId = p.userId;
    } else if (action === 'AUTO_ASSIGN') {
      const teamArr = Array.from(room.teams.values());
      if (teamArr.length > 0) {
        const players = Array.from(room.participants.values());
        players.forEach((p, idx) => {
          const targetTeam = teamArr[idx % teamArr.length];
          p.teamId = targetTeam.id;
        });
      }
    } else if (action === 'SET_FORMAT' && actionPayload.teamPlayFormat) {
      room.teamPlayFormat = actionPayload.teamPlayFormat;
    }

    this.syncTeamMemberships(room);
    this.persistRoomSnapshot(room);
    this.scheduleBroadcastRoomState(room, true, 'room:updated');
    return this.toPublicState(room);
  }

  private upsertParticipant(
    room: InternalRoom,
    user: UserProfile,
    customDisplayName?: string
  ): { participant: InternalParticipant; isReconnect: boolean } {
    const existing = room.participants.get(user.id);
    const chosenName =
      customDisplayName && customDisplayName.trim().length >= 2
        ? customDisplayName.trim().slice(0, 60)
        : existing?.displayName || user.fullName;

    if (existing) {
      if (!room.allowRejoinPolicy && !existing.isOnline && user.id !== room.hostId) {
        throw new ApiValidationError(
          'Phòng thi đấu này đã cấu hình không cho phép tham gia lại sau khi rời phòng.',
          403
        );
      }
      existing.isOnline = true;
      existing.displayName = chosenName;
      existing.avatarUrl = user.avatarUrl || existing.avatarUrl;
      this.repo.upsertGameParticipantRecord({
        roomId: room.id,
        userId: user.id,
        displayName: existing.displayName,
        role: user.role,
        isOnline: true,
      });
      return { participant: existing, isReconnect: true };
    }

    // Check if room is locked to new entrants
    if (room.isJoinLocked && user.id !== room.hostId && user.role !== 'ADMIN') {
      throw new ApiValidationError(
        'Phòng thi đấu đã được Giáo viên khóa tiếp nhận người chơi mới.',
        403,
        'ROOM_LOCKED'
      );
    }

    if (room.status === 'FINISHED' && user.id !== room.hostId && user.role !== 'ADMIN') {
      throw new ApiValidationError('Trận đấu trong phòng này đã kết thúc.', 400, 'ROOM_FINISHED');
    }

    // Check classroom permission if CLASSROOM_ONLY
    if (
      room.accessPolicy === 'CLASSROOM_ONLY' &&
      room.classroomId &&
      user.id !== room.hostId &&
      user.role !== 'ADMIN' &&
      user.role !== 'TEACHER'
    ) {
      const enrolled = this.repo.isStudentInClassroom(room.classroomId, user.id);
      if (!enrolled) {
        throw new ApiValidationError(
          'Phòng thi đấu này chỉ dành riêng cho học sinh thuộc lớp được chỉ định.',
          403,
          'CLASSROOM_RESTRICTED'
        );
      }
    }

    if (room.participants.size >= room.maxParticipants) {
      throw new ApiValidationError(
        `Phòng thi đấu đã đạt giới hạn tối đa ${room.maxParticipants} người tham gia đồng thời.`,
        403,
        'ROOM_FULL'
      );
    }

    // Auto-assign to smallest team if room is in Team Mode
    let assignedTeamId: string | null = null;
    if (room.isTeamMode && room.teams.size > 0) {
      const sortedTeams = Array.from(room.teams.values()).sort(
        (a, b) => a.memberUserIds.length - b.memberUserIds.length
      );
      assignedTeamId = sortedTeams[0].id;
    }

    const participant: InternalParticipant = {
      id: `part_${user.id}`,
      roomId: room.id,
      userId: user.id,
      displayName: chosenName,
      avatarUrl: user.avatarUrl || '',
      role: user.role,
      teamId: assignedTeamId,
      teamName: null,
      teamColorHex: null,
      isTeamCaptain: false,
      score: 0,
      correctCount: 0,
      answeredCount: 0,
      totalResponseTimeMs: 0,
      avgResponseTimeMs: 0,
      streak: 0,
      maxStreak: 0,
      hasAnsweredCurrent: false,
      lastEarnedPoints: 0,
      lastSelectedIndex: null,
      lastSelectedIndices: [],
      lastAnswerCorrect: null,
      isOnline: true,
    };
    room.participants.set(user.id, participant);
    this.syncTeamMemberships(room);

    this.repo.upsertGameParticipantRecord({
      roomId: room.id,
      userId: user.id,
      displayName: participant.displayName,
      role: user.role,
      isOnline: true,
    });

    return { participant, isReconnect: false };
  }

  public joinRoomByCode(
    code: string,
    user: UserProfile,
    customDisplayName?: string
  ): LiveRoomState {
    const normalized = code.trim();
    const room = this.roomsByCode.get(normalized);
    if (!room) {
      throw new ApiValidationError(
        `Không tìm thấy phòng thi đấu với mã PIN "${normalized}".`,
        404
      );
    }

    // If customDisplayName is provided when ALLOW_GUEST is disabled, only allow if it matches user's own account or guest mode is enabled
    const effectiveDisplayName =
      room.accessPolicy === 'ALLOW_GUEST' && customDisplayName
        ? customDisplayName
        : undefined;

    const { isReconnect } = this.upsertParticipant(room, user, effectiveDisplayName);
    room.lastEventType = isReconnect ? 'player:reconnect' : 'player:join';
    this.persistRoomSnapshot(room);
    this.scheduleBroadcastRoomState(room, true, room.lastEventType);
    return this.toPublicState(room);
  }

  public leaveRoom(code: string, user: UserProfile): LiveRoomState {
    const room = this.roomsByCode.get(code.trim());
    if (!room) {
      throw new ApiValidationError('Phòng thi đấu không tồn tại.', 404);
    }
    const p = room.participants.get(user.id);
    if (p) {
      if (room.status === 'LOBBY' && user.id !== room.hostId) {
        room.participants.delete(user.id);
      } else {
        p.isOnline = false;
      }
      room.lastEventType = 'player:leave';
      this.persistRoomSnapshot(room);
      this.scheduleBroadcastRoomState(room, true, 'player:leave');
    }
    return this.toPublicState(room);
  }

  public getRoomState(code: string): LiveRoomState | null {
    const room = this.roomsByCode.get(code.trim());
    return room ? this.toPublicState(room) : null;
  }

  private assertCanControlRoom(room: InternalRoom, user: UserProfile): void {
    const isHost = room.hostId === user.id;
    const isAdmin = user.role === 'ADMIN';
    if (!isHost && !isAdmin && !room.isTestMode) {
      throw new ApiValidationError(
        'Chỉ Giáo viên chủ phòng hoặc Quản trị viên mới có quyền điều khiển trạng thái phòng thi đấu.',
        403
      );
    }
  }

  public toggleRoomJoinLock(
    code: string,
    user: UserProfile,
    isJoinLocked?: boolean
  ): LiveRoomState {
    const room = this.roomsByCode.get(code.trim());
    if (!room) {
      throw new ApiValidationError('Phòng thi đấu không tồn tại.', 404);
    }
    this.assertCanControlRoom(room, user);
    room.isJoinLocked =
      typeof isJoinLocked === 'boolean' ? isJoinLocked : !room.isJoinLocked;
    room.lastEventType = 'room:updated';
    this.persistRoomSnapshot(room);
    this.scheduleBroadcastRoomState(room, true, 'room:updated');
    return this.toPublicState(room);
  }

  public pauseRoom(code: string, user: UserProfile): LiveRoomState {
    const room = this.roomsByCode.get(code.trim());
    if (!room) {
      throw new ApiValidationError('Phòng thi đấu không tồn tại.', 404);
    }
    this.assertCanControlRoom(room, user);
    if (room.status !== 'QUESTION_ACTIVE') {
      throw new ApiValidationError('Chỉ có thể tạm dừng khi câu hỏi đang diễn ra.', 400);
    }

    this.clearRoomTimer(room);
    const now = Date.now();
    room.pausedRemainingMs = room.questionEndsAt
      ? Math.max(1000, room.questionEndsAt - now)
      : 5000;
    room.questionEndsAt = null;
    room.status = 'PAUSED';
    room.lastEventType = 'game:paused';
    this.persistRoomSnapshot(room);
    this.scheduleBroadcastRoomState(room, true, 'game:paused');
    return this.toPublicState(room);
  }

  public resumeRoom(code: string, user: UserProfile): LiveRoomState {
    const room = this.roomsByCode.get(code.trim());
    if (!room) {
      throw new ApiValidationError('Phòng thi đấu không tồn tại.', 404);
    }
    this.assertCanControlRoom(room, user);
    if (room.status !== 'PAUSED') {
      throw new ApiValidationError('Phòng thi đấu hiện không ở trạng thái tạm dừng.', 400);
    }

    const remainingMs = Math.max(2000, room.pausedRemainingMs || 10000);
    const now = Date.now();
    room.status = 'QUESTION_ACTIVE';
    room.questionEndsAt = now + remainingMs;
    room.pausedRemainingMs = null;
    room.lastEventType = 'game:resumed';

    const activeIdx = room.currentQuestionIndex;
    room.timerHandle = setTimeout(() => {
      if (room.status === 'QUESTION_ACTIVE' && room.currentQuestionIndex === activeIdx) {
        this.revealCurrentQuestion(room);
      }
    }, remainingMs);

    this.persistRoomSnapshot(room);
    this.scheduleBroadcastRoomState(room, true, 'game:resumed');
    return this.toPublicState(room);
  }

  public endRoom(code: string, user: UserProfile): LiveRoomState {
    const room = this.roomsByCode.get(code.trim());
    if (!room) {
      throw new ApiValidationError('Phòng thi đấu không tồn tại.', 404);
    }
    this.assertCanControlRoom(room, user);
    if (room.status === 'QUESTION_ACTIVE' || room.status === 'PAUSED') {
      this.revealCurrentQuestion(room);
    }
    this.finishRoom(room);
    return this.toPublicState(room);
  }

  public startRoomOrNextQuestion(code: string, user: UserProfile): LiveRoomState {
    const room = this.roomsByCode.get(code.trim());
    if (!room) {
      throw new ApiValidationError('Phòng thi đấu không tồn tại.', 404);
    }
    this.assertCanControlRoom(room, user);

    if (room.status === 'LOBBY') {
      this.activateQuestion(room, 0, true);
    } else if (room.status === 'PAUSED') {
      return this.resumeRoom(code, user);
    } else if (room.status === 'QUESTION_REVEAL') {
      const nextIdx = room.currentQuestionIndex + 1;
      if (nextIdx >= room.questions.length) {
        this.finishRoom(room);
      } else {
        this.activateQuestion(room, nextIdx, false);
      }
    } else if (room.status === 'QUESTION_ACTIVE') {
      this.revealCurrentQuestion(room);
    }

    return this.toPublicState(room);
  }

  public forceRevealQuestion(code: string, user: UserProfile): LiveRoomState {
    const room = this.roomsByCode.get(code.trim());
    if (!room) {
      throw new ApiValidationError('Phòng thi đấu không tồn tại.', 404);
    }
    this.assertCanControlRoom(room, user);
    if (room.status === 'QUESTION_ACTIVE' || room.status === 'PAUSED') {
      this.revealCurrentQuestion(room);
    }
    return this.toPublicState(room);
  }

  private clearRoomTimer(room: InternalRoom): void {
    if (room.timerHandle) {
      clearTimeout(room.timerHandle);
      room.timerHandle = null;
    }
  }

  private onMatchCompletedCallback:
    | ((payload: {
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
      }) => void)
    | null = null;

  public setOnMatchCompletedCallback(
    cb: (payload: {
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
    }) => void
  ): void {
    this.onMatchCompletedCallback = cb;
  }

  private activateQuestion(room: InternalRoom, index: number, isFirstStart: boolean): void {
    this.clearRoomTimer(room);
    const question = room.questions[index];
    if (!question) {
      this.finishRoom(room);
      return;
    }

    room.status = 'QUESTION_ACTIVE';
    room.currentQuestionIndex = index;
    room.pausedRemainingMs = null;
    room.currentRoundSubmissions.clear();

    this.syncTeamMemberships(room);
    if (room.isTeamMode) {
      for (const team of room.teams.values()) {
        if (team.memberUserIds.length > 0) {
          team.activeTurnUserId = team.memberUserIds[index % team.memberUserIds.length];
        } else {
          team.activeTurnUserId = null;
        }
      }
    }

    for (const p of room.participants.values()) {
      p.hasAnsweredCurrent = false;
      p.lastEarnedPoints = 0;
      p.lastSelectedIndex = null;
      p.lastSelectedIndices = [];
      p.lastAnswerCorrect = null;
    }

    const now = Date.now();
    const durationMs = Math.max(5, question.timeLimitSec) * 1000;
    room.questionStartedAt = now;
    room.questionEndsAt = now + durationMs;
    room.lastEventType = isFirstStart ? 'game:started' : 'question:started';

    this.persistRoomSnapshot(room);

    room.timerHandle = setTimeout(() => {
      if (room.status === 'QUESTION_ACTIVE' && room.currentQuestionIndex === index) {
        this.revealCurrentQuestion(room);
      }
    }, durationMs);

    this.scheduleBroadcastRoomState(room, true, room.lastEventType);
  }

  /**
   * Section VII: 6-Step Server-Authoritative Answer Verification & Scoring
   */
  public submitAnswer(
    code: string,
    user: UserProfile,
    selectedIndexOrPayload:
      | number
      | {
          selectedIndex?: number;
          selectedIndices?: number[];
          questionId?: string;
          sessionId?: string;
        }
  ): LiveRoomState {
    const room = this.roomsByCode.get(code.trim());
    if (!room) {
      throw new ApiValidationError('Phòng thi đấu không tồn tại.', 404);
    }

    // 1. Check if player is registered in the room
    const participant = room.participants.get(user.id);
    if (!participant) {
      throw new ApiValidationError(
        'Bạn chưa tham gia phòng thi đấu này nên không thể gửi câu trả lời.',
        403
      );
    }

    // 2. Check if game session is currently active (not PAUSED, not REVEAL, not LOBBY, not FINISHED)
    if (room.status === 'PAUSED') {
      throw new ApiValidationError(
        'Trận đấu đang tạm dừng. Vui lòng chờ Giáo viên tiếp tục.',
        400
      );
    }
    if (room.status !== 'QUESTION_ACTIVE') {
      throw new ApiValidationError('Câu hỏi hiện tại đã kết thúc hoặc chưa bắt đầu.', 400);
    }

    const question = room.questions[room.currentQuestionIndex];
    if (!question) {
      throw new ApiValidationError('Không tìm thấy câu hỏi hiện tại.', 400);
    }

    // Team mode role checks (CAPTAIN_REPRESENTATIVE and TURN_BY_TURN)
    if (room.isTeamMode && participant.teamId && room.teams.has(participant.teamId)) {
      const team = room.teams.get(participant.teamId)!;
      if (
        room.teamPlayFormat === 'CAPTAIN_REPRESENTATIVE' &&
        team.captainUserId &&
        team.captainUserId !== user.id
      ) {
        throw new ApiValidationError(
          'Chế độ Đội trưởng đại diện: Chỉ đội trưởng mới được quyền chốt đáp án cho đội.',
          403
        );
      }
      if (
        room.teamPlayFormat === 'TURN_BY_TURN' &&
        team.activeTurnUserId &&
        team.activeTurnUserId !== user.id
      ) {
        throw new ApiValidationError(
          'Chế độ Luân phiên theo lượt: Hiện tại đang là lượt trả lời của thành viên khác trong đội.',
          403
        );
      }
    }

    // Normalize payload
    const payload =
      typeof selectedIndexOrPayload === 'number'
        ? { selectedIndex: selectedIndexOrPayload }
        : selectedIndexOrPayload || {};

    // 3. Verify questionId & sessionId if sent by client
    if (payload.sessionId && payload.sessionId !== room.sessionId) {
      throw new ApiValidationError('Mã phiên thi đấu (sessionId) không khớp.', 400);
    }
    if (payload.questionId && payload.questionId !== question.id) {
      throw new ApiValidationError(
        'Mã câu hỏi gửi lên không khớp với câu hỏi đang diễn ra trên máy chủ.',
        400
      );
    }

    // 4. Verify server countdown timer has not expired
    const now = Date.now();
    if (room.questionEndsAt && now > room.questionEndsAt + 1200) {
      throw new ApiValidationError(
        'Đã hết thời gian trả lời cho câu hỏi này. Máy chủ đã khóa nhận đáp án.',
        400
      );
    }

    // 5. Prevent duplicate answer submission for the same question
    if (room.currentRoundSubmissions.has(user.id) || participant.hasAnsweredCurrent) {
      throw new ApiValidationError(
        'Bạn đã gửi câu trả lời cho câu hỏi này rồi. Mỗi học sinh chỉ được tính một lần trả lời.',
        409
      );
    }

    // 6. Validate option indices against current question options
    const maxOptIdx = Math.max(1, question.options.length - 1);
    let selectedIndices: number[] = [];
    let primarySelectedIndex = 0;

    if (Array.isArray(payload.selectedIndices) && payload.selectedIndices.length > 0) {
      selectedIndices = Array.from(new Set(payload.selectedIndices.map((n) => Number(n))));
      if (
        selectedIndices.some((idx) => !Number.isInteger(idx) || idx < 0 || idx > maxOptIdx)
      ) {
        throw new ApiValidationError(
          `Lựa chọn đáp án phải nằm trong khoảng 0 đến ${maxOptIdx}.`,
          400
        );
      }
      primarySelectedIndex = selectedIndices[0];
    } else if (typeof payload.selectedIndex === 'number') {
      if (
        !Number.isInteger(payload.selectedIndex) ||
        payload.selectedIndex < 0 ||
        payload.selectedIndex > maxOptIdx
      ) {
        throw new ApiValidationError(
          `Lựa chọn đáp án phải nằm trong khoảng 0 đến ${maxOptIdx}.`,
          400
        );
      }
      primarySelectedIndex = payload.selectedIndex;
      selectedIndices = [primarySelectedIndex];
    } else {
      throw new ApiValidationError('Dữ liệu phương án trả lời không hợp lệ.', 400);
    }

    const startedAt = room.questionStartedAt || now;

    // Server-authoritative scoring via dedicated Scoring Engine module
    const scoreResult = ServerScoringEngine.calculateAnswerScore({
      gameMode: room.gameMode,
      questionType: question.questionType || 'SINGLE_CHOICE',
      basePoints: question.points,
      timeLimitSec: question.timeLimitSec,
      questionStartedAtMs: startedAt,
      answeredAtMs: now,
      selectedOptionIndex: primarySelectedIndex,
      selectedOptionIndices: selectedIndices,
      correctOptionIndex: question.correctIndex,
      correctOptionIndices: question.correctIndices,
      currentStreak: participant.streak,
    });

    // Database-level idempotency check in `player_answers` table (UNIQUE(session_id, user_id, question_id))
    const inserted = this.repo.recordPlayerAnswer({
      sessionId: room.sessionId,
      roomId: room.id,
      userId: user.id,
      questionId: question.id,
      questionIndex: room.currentQuestionIndex,
      selectedIndex: primarySelectedIndex,
      isCorrect: scoreResult.isCorrect,
      earnedPoints: scoreResult.totalEarnedPoints,
      responseTimeMs: scoreResult.responseTimeMs,
    });

    if (!inserted) {
      throw new ApiValidationError(
        'Bạn đã gửi câu trả lời cho câu hỏi này rồi.',
        409
      );
    }

    room.currentRoundSubmissions.set(user.id, {
      userId: user.id,
      selectedIndex: primarySelectedIndex,
      selectedIndices,
      isCorrect: scoreResult.isCorrect,
      earnedPoints: scoreResult.totalEarnedPoints,
      responseTimeMs: scoreResult.responseTimeMs,
    });

    participant.hasAnsweredCurrent = true;
    participant.lastSelectedIndex = primarySelectedIndex;
    participant.lastSelectedIndices = selectedIndices;
    room.lastEventType = 'answer:submitted';

    // If all participants in the room have answered in test mode, reveal immediately
    if (room.isTestMode && room.currentRoundSubmissions.size >= room.participants.size) {
      this.revealCurrentQuestion(room);
      return this.toPublicState(room);
    }

    this.persistRoomSnapshot(room);
    // Use debounced broadcast (40ms window) to handle 100 concurrent players submitting simultaneously
    this.scheduleBroadcastRoomState(room, false, 'answer:submitted');
    return this.toPublicState(room);
  }

  private revealCurrentQuestion(room: InternalRoom): void {
    this.clearRoomTimer(room);
    if (room.status !== 'QUESTION_ACTIVE' && room.status !== 'PAUSED') return;

    room.status = 'QUESTION_REVEAL';
    room.pausedRemainingMs = null;
    room.lastEventType = 'answer:result';
    const question = room.questions[room.currentQuestionIndex];

    for (const p of room.participants.values()) {
      const submission = room.currentRoundSubmissions.get(p.userId);
      if (submission) {
        p.lastSelectedIndex = submission.selectedIndex;
        p.lastSelectedIndices = submission.selectedIndices;
        p.lastAnswerCorrect = submission.isCorrect;
        p.lastEarnedPoints = submission.earnedPoints;
        p.answeredCount += 1;
        p.totalResponseTimeMs += submission.responseTimeMs;
        p.avgResponseTimeMs = Math.round(p.totalResponseTimeMs / p.answeredCount);

        p.score = Math.max(0, p.score + submission.earnedPoints);
        if (submission.isCorrect) {
          p.correctCount += 1;
          p.streak += 1;
          if (p.streak > p.maxStreak) {
            p.maxStreak = p.streak;
          }
        } else {
          p.streak = 0;
        }

        room.allSubmissions.push({
          userId: p.userId,
          questionId: question.id,
          questionIndex: room.currentQuestionIndex,
          prompt: question.prompt,
          options: question.options,
          selectedIndex: submission.selectedIndex,
          correctIndex: question.correctIndex,
          isCorrect: submission.isCorrect,
          earnedPoints: submission.earnedPoints,
          responseTimeMs: submission.responseTimeMs,
          explanation: question.explanation,
        });
      } else {
        p.lastSelectedIndex = null;
        p.lastSelectedIndices = [];
        p.lastAnswerCorrect = false;
        p.lastEarnedPoints = 0;
        p.streak = 0;

        room.allSubmissions.push({
          userId: p.userId,
          questionId: question.id,
          questionIndex: room.currentQuestionIndex,
          prompt: question.prompt,
          options: question.options,
          selectedIndex: null,
          correctIndex: question.correctIndex,
          isCorrect: false,
          earnedPoints: 0,
          responseTimeMs: question.timeLimitSec * 1000,
          explanation: question.explanation,
        });
      }
    }

    // Section V: Deterministic Team Scoring without duplicate inflation
    if (room.isTeamMode && room.teams.size > 0) {
      this.syncTeamMemberships(room);
      for (const team of room.teams.values()) {
        const teamSubs = team.memberUserIds
          .map((uid) => room.currentRoundSubmissions.get(uid))
          .filter((s): s is NonNullable<typeof s> => Boolean(s));

        if (teamSubs.length === 0) continue;

        if (room.teamPlayFormat === 'CAPTAIN_REPRESENTATIVE') {
          const capSub = team.captainUserId
            ? room.currentRoundSubmissions.get(team.captainUserId)
            : teamSubs[0];
          if (capSub) {
            team.totalScore = Math.max(0, team.totalScore + capSub.earnedPoints);
            if (capSub.isCorrect) team.correctCount += 1;
          }
        } else if (room.teamPlayFormat === 'TURN_BY_TURN') {
          const turnSub = team.activeTurnUserId
            ? room.currentRoundSubmissions.get(team.activeTurnUserId)
            : teamSubs[0];
          if (turnSub) {
            team.totalScore = Math.max(0, team.totalScore + turnSub.earnedPoints);
            if (turnSub.isCorrect) team.correctCount += 1;
          }
        } else if (room.teamPlayFormat === 'TEAM_CONSENSUS') {
          // Majority vote among submitted members; normalized so a 5-member team does not get 5x a 2-member team
          const correctSubs = teamSubs.filter((s) => s.isCorrect);
          const isMajorityCorrect = correctSubs.length * 2 >= teamSubs.length && correctSubs.length > 0;
          if (isMajorityCorrect) {
            const avgEarned = Math.round(
              correctSubs.reduce((acc, s) => acc + s.earnedPoints, 0) / correctSubs.length
            );
            const consensusBonus = correctSubs.length === team.memberUserIds.length && team.memberUserIds.length > 1 ? 15 : 0;
            team.totalScore = Math.max(0, team.totalScore + avgEarned + consensusBonus);
            team.correctCount += 1;
          }
        } else {
          // ALL_MEMBERS_SCORE: Average score per team member to prevent large teams from dominating unfairly
          const sumPoints = teamSubs.reduce((acc, s) => acc + s.earnedPoints, 0);
          const divisor = Math.max(1, team.memberUserIds.length);
          const normalizedTeamRoundScore = Math.round(sumPoints / divisor);
          team.totalScore = Math.max(0, team.totalScore + normalizedTeamRoundScore);
          if (teamSubs.some((s) => s.isCorrect)) {
            team.correctCount += 1;
          }
        }
      }
    }

    this.persistRoomSnapshot(room);
    this.scheduleBroadcastRoomState(room, true, 'answer:result');
  }

  private finishRoom(room: InternalRoom): void {
    this.clearRoomTimer(room);
    room.status = 'FINISHED';
    room.questionStartedAt = null;
    room.questionEndsAt = null;
    room.pausedRemainingMs = null;
    room.lastEventType = 'game:finished';

    if (!room.persistedToDb) {
      room.persistedToDb = true;
      const participantsArr = Array.from(room.participants.values()).map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        role: p.role,
        score: p.score,
        correctCount: p.correctCount,
        maxStreak: p.maxStreak,
      }));

      this.repo.upsertGameRoomRecord({
        roomId: room.id,
        sessionId: room.sessionId,
        code: room.code,
        title: room.title,
        quizId: room.questionSetId,
        classroomId: room.classroomId,
        hostId: room.hostId,
        status: 'FINISHED',
        maxParticipants: room.maxParticipants,
        isTestMode: room.isTestMode,
        totalQuestions: room.questions.length,
        snapshotJson: '',
      });

      this.repo.saveCompletedMatch({
        roomId: room.id,
        sessionId: room.sessionId,
        roomCode: room.code,
        roomTitle: room.title,
        questionSetId: room.questionSetId,
        questionSetTitle: room.questionSetTitle,
        hostId: room.hostId,
        hostName: room.hostName,
        totalQuestions: room.questions.length,
        participants: participantsArr,
        submissions: room.allSubmissions,
      });

      this.repo.logActivity({
        actorId: room.hostId,
        actorName: room.hostName,
        actorRole: 'TEACHER',
        action: 'GAME_SESSION_COMPLETED',
        module: 'GameEngine',
        targetId: room.code,
        details: `Hoàn tất trận đấu "${room.title}" với ${participantsArr.length} người tham gia`,
      });

      if (this.onMatchCompletedCallback) {
        try {
          this.onMatchCompletedCallback({
            roomId: room.id,
            sessionId: room.sessionId,
            roomCode: room.code,
            roomTitle: room.title,
            questionSetId: room.questionSetId,
            classroomId: room.classroomId,
            isTeamMode: room.isTeamMode,
            totalQuestions: room.questions.length,
            participants: Array.from(room.participants.values()).map((p) => ({
              userId: p.userId,
              displayName: p.displayName,
              role: p.role,
              score: p.score,
              correctCount: p.correctCount,
              maxStreak: p.maxStreak,
              avgResponseTimeMs: p.avgResponseTimeMs,
              teamId: p.teamId ?? null,
            })),
          });
        } catch (err) {
          console.error('Error in onMatchCompletedCallback:', err);
        }
      }
    }

    this.scheduleBroadcastRoomState(room, true, 'game:finished');
  }

  /**
   * SECURITY BOUNDARY:
   * Never sends `correctIndex`, `correctIndices`, or `explanation` to client browsers while `status === 'QUESTION_ACTIVE'` or `'PAUSED'`.
   * Also respects `revealAnswersPolicy === 'END_OF_MATCH'` by keeping answers hidden during QUESTION_REVEAL until FINISHED.
   */
  private toPublicState(room: InternalRoom): LiveRoomState {
    const rawQuestion = room.questions[room.currentQuestionIndex] || null;
    let publicQuestion: PublicQuestion | null = null;
    let revealedCorrectIndex: number | null = null;
    let revealedCorrectIndices: number[] | null = null;
    let revealedExplanation: string | null = null;
    let answerDistribution: RoomAnswerDistribution | null = null;

    if (
      rawQuestion &&
      (room.status === 'QUESTION_ACTIVE' ||
        room.status === 'PAUSED' ||
        room.status === 'QUESTION_REVEAL')
    ) {
      publicQuestion = {
        id: rawQuestion.id,
        questionSetId: rawQuestion.questionSetId,
        orderIndex: rawQuestion.orderIndex,
        questionType: rawQuestion.questionType || 'SINGLE_CHOICE',
        prompt: rawQuestion.prompt,
        imageUrl: rawQuestion.imageUrl,
        audioUrl: rawQuestion.audioUrl,
        videoUrl: rawQuestion.videoUrl,
        options: rawQuestion.options,
        timeLimitSec: rawQuestion.timeLimitSec,
        points: rawQuestion.points,
      };
    }

    const canRevealAnswerNow =
      room.status === 'FINISHED' ||
      (room.status === 'QUESTION_REVEAL' && room.revealAnswersPolicy !== 'END_OF_MATCH');

    if (rawQuestion && (room.status === 'QUESTION_REVEAL' || room.status === 'FINISHED')) {
      if (canRevealAnswerNow) {
        revealedCorrectIndex = rawQuestion.correctIndex;
        revealedCorrectIndices =
          Array.isArray(rawQuestion.correctIndices) && rawQuestion.correctIndices.length > 0
            ? rawQuestion.correctIndices
            : [rawQuestion.correctIndex];
        revealedExplanation = rawQuestion.explanation;
      }

      const counts: number[] = new Array(rawQuestion.options.length).fill(0);
      let totalAnswers = 0;
      for (const sub of room.currentRoundSubmissions.values()) {
        for (const chosenIdx of sub.selectedIndices) {
          if (chosenIdx >= 0 && chosenIdx < counts.length) {
            counts[chosenIdx] += 1;
          }
        }
        totalAnswers += 1;
      }
      answerDistribution = { counts, totalAnswers };
    }

    // Section IX: Live Leaderboard deterministic sorting with tie-breaker:
    // 1. Higher total score -> 2. Higher correctCount -> 3. Lower avgResponseTimeMs -> 4. Alphabetical displayName
    const isQuestionHidden = room.status === 'QUESTION_ACTIVE' || room.status === 'PAUSED';
    const sortedParticipants = Array.from(room.participants.values())
      .map((p) => ({
        id: p.id,
        roomId: p.roomId,
        userId: p.userId,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        role: p.role,
        teamId: p.teamId,
        teamName: p.teamName,
        teamColorHex: p.teamColorHex,
        isTeamCaptain: p.isTeamCaptain,
        score: p.score,
        correctCount: p.correctCount,
        answeredCount: p.answeredCount,
        avgResponseTimeMs: p.avgResponseTimeMs,
        streak: p.streak,
        hasAnsweredCurrent: p.hasAnsweredCurrent,
        lastEarnedPoints: isQuestionHidden ? 0 : p.lastEarnedPoints,
        lastSelectedIndex: p.lastSelectedIndex,
        lastSelectedIndices: p.lastSelectedIndices,
        lastAnswerCorrect: isQuestionHidden || !canRevealAnswerNow ? null : p.lastAnswerCorrect,
        isOnline: p.isOnline,
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
        const aTime = a.avgResponseTimeMs || 999999;
        const bTime = b.avgResponseTimeMs || 999999;
        if (aTime !== bTime) return aTime - bTime;
        return a.displayName.localeCompare(b.displayName, 'vi');
      });

    const sortedTeams = Array.from(room.teams.values())
      .map((t) => ({ ...t }))
      .sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
        return a.name.localeCompare(b.name, 'vi');
      });

    return {
      id: room.id,
      sessionId: room.sessionId,
      code: room.code,
      title: room.title,
      description: room.description,
      questionSetId: room.questionSetId,
      questionSetTitle: room.questionSetTitle,
      classroomId: room.classroomId,
      hostId: room.hostId,
      hostName: room.hostName,
      isTestMode: room.isTestMode,
      gameMode: room.gameMode,
      accessPolicy: room.accessPolicy,
      isPublic: room.isPublic,
      isJoinLocked: room.isJoinLocked,
      timeLimitOverrideSec: room.timeLimitOverrideSec,
      pointsOverride: room.pointsOverride,
      maxParticipants: room.maxParticipants,
      isTeamMode: room.isTeamMode,
      teamPlayFormat: room.teamPlayFormat,
      teams: sortedTeams,
      revealAnswersPolicy: room.revealAnswersPolicy,
      publicLeaderboardPolicy: room.publicLeaderboardPolicy,
      allowRejoinPolicy: room.allowRejoinPolicy,
      maxAttemptsPerPlayer: room.maxAttemptsPerPlayer,
      status: room.status,
      currentQuestionIndex: room.currentQuestionIndex,
      totalQuestions: room.questions.length,
      questionStartedAt: room.questionStartedAt,
      questionEndsAt: room.questionEndsAt,
      pausedRemainingMs: room.pausedRemainingMs,
      serverTimeMs: Date.now(),
      lastEventType: room.lastEventType,
      currentQuestion: publicQuestion,
      revealedCorrectIndex,
      revealedCorrectIndices,
      revealedExplanation,
      answerDistribution,
      participants: sortedParticipants,
    };
  }

  public attachWebSocketClient(ws: WebSocket, user: UserProfile): void {
    const conn: ClientConnection = {
      ws,
      userId: user.id,
      roomCode: null,
      isAlive: true,
    };
    this.clients.add(conn);

    ws.on('pong', () => {
      conn.isAlive = true;
    });

    ws.on('message', (rawData) => {
      conn.isAlive = true;
      try {
        const msg = JSON.parse(String(rawData));
        if (msg.type === 'ping') {
          this.sendJson(ws, { type: 'pong', serverTimeMs: Date.now() });
          return;
        }
        if (
          (msg.type === 'room:subscribe' || msg.type === 'player:join') &&
          typeof msg.roomCode === 'string'
        ) {
          const code = msg.roomCode.trim();
          conn.roomCode = code;
          const room = this.roomsByCode.get(code);
          if (room) {
            const { isReconnect } = this.upsertParticipant(
              room,
              user,
              typeof msg.displayName === 'string' ? msg.displayName : undefined
            );
            const evType: RealtimeEventType = isReconnect ? 'player:reconnect' : 'player:join';
            room.lastEventType = evType;
            // Send immediate state sync on connect/reconnect
            const publicState = this.toPublicState(room);
            this.sendJson(ws, {
              type: 'room:state',
              eventType: evType,
              room: publicState,
            });
            this.scheduleBroadcastRoomState(room, false, evType);
          }
        } else if (
          (msg.type === 'room:submit_answer' || msg.type === 'answer:submitted') &&
          typeof msg.roomCode === 'string'
        ) {
          const state = this.submitAnswer(msg.roomCode, user, {
            selectedIndex:
              typeof msg.selectedIndex === 'number' ? Number(msg.selectedIndex) : undefined,
            selectedIndices: Array.isArray(msg.selectedIndices)
              ? msg.selectedIndices
              : undefined,
            questionId: typeof msg.questionId === 'string' ? msg.questionId : undefined,
            sessionId: typeof msg.sessionId === 'string' ? msg.sessionId : undefined,
          });
          this.sendJson(ws, {
            type: 'room:state',
            eventType: 'answer:submitted',
            room: state,
          });
        } else if (
          (msg.type === 'room:next' || msg.type === 'game:started') &&
          typeof msg.roomCode === 'string'
        ) {
          this.startRoomOrNextQuestion(msg.roomCode, user);
        } else if (msg.type === 'room:reveal' && typeof msg.roomCode === 'string') {
          this.forceRevealQuestion(msg.roomCode, user);
        } else if (
          (msg.type === 'room:pause' || msg.type === 'game:paused') &&
          typeof msg.roomCode === 'string'
        ) {
          this.pauseRoom(msg.roomCode, user);
        } else if (
          (msg.type === 'room:resume' || msg.type === 'game:resumed') &&
          typeof msg.roomCode === 'string'
        ) {
          this.resumeRoom(msg.roomCode, user);
        } else if (
          (msg.type === 'room:end' || msg.type === 'game:finished') &&
          typeof msg.roomCode === 'string'
        ) {
          this.endRoom(msg.roomCode, user);
        }
      } catch (err: any) {
        this.sendJson(ws, {
          type: 'room:error',
          error: err?.message || 'Lỗi xử lý sự kiện thời gian thực.',
        });
      }
    });

    ws.on('close', () => {
      this.handleClientDisconnect(conn);
    });
  }

  private handleClientDisconnect(conn: ClientConnection): void {
    if (!this.clients.has(conn)) return;
    this.clients.delete(conn);

    if (conn.roomCode) {
      const room = this.roomsByCode.get(conn.roomCode);
      if (room) {
        // Check if user still has another active tab/socket in the same room
        const stillConnected = Array.from(this.clients).some(
          (c) => c.userId === conn.userId && c.roomCode === conn.roomCode
        );
        if (!stillConnected) {
          const p = room.participants.get(conn.userId);
          if (p) {
            p.isOnline = false;
            room.lastEventType = 'player:leave';
            this.repo.upsertGameParticipantRecord({
              roomId: room.id,
              userId: p.userId,
              displayName: p.displayName,
              role: p.role,
              isOnline: false,
            });
            this.scheduleBroadcastRoomState(room, false, 'player:leave');
          }
        }
      }
    }
  }

  private sendJson(ws: WebSocket, payload: unknown): void {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(payload));
    }
  }

  /**
   * Coalesces high-frequency broadcasts within a 40ms window when 100 players submit answers concurrently,
   * while sending phase transitions (LOBBY -> QUESTION_ACTIVE -> PAUSED -> QUESTION_REVEAL -> FINISHED) immediately.
   */
  private scheduleBroadcastRoomState(
    room: InternalRoom,
    immediate: boolean,
    eventType: RealtimeEventType = 'room:updated'
  ): void {
    room.lastEventType = eventType;
    if (immediate) {
      if (room.broadcastDebounceHandle) {
        clearTimeout(room.broadcastDebounceHandle);
        room.broadcastDebounceHandle = null;
      }
      this.broadcastRoomStateNow(room, eventType);
      return;
    }

    if (room.broadcastDebounceHandle) {
      return;
    }

    room.broadcastDebounceHandle = setTimeout(() => {
      room.broadcastDebounceHandle = null;
      this.broadcastRoomStateNow(room, room.lastEventType);
    }, 40);
  }

  private broadcastRoomStateNow(room: InternalRoom, eventType: RealtimeEventType): void {
    const publicState = this.toPublicState(room);
    const payloadStr = JSON.stringify({
      type: 'room:state',
      eventType,
      room: publicState,
    });

    for (const conn of this.clients) {
      if (conn.roomCode === room.code && conn.ws.readyState === 1) {
        conn.ws.send(payloadStr);
      }
    }
  }
}
