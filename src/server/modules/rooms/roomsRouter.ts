import { Router } from 'express';
import type { AuthenticatedRequest } from '../../auth.ts';
import type { IDataRepository } from '../../repository.ts';
import type { ArenaRealtimeManager } from '../../arenaManager.ts';
import type { GameMode, RoomAccessPolicy, TeamPlayFormat } from '../../../types/arena.ts';
import {
  ApiValidationError,
  requireNonEmptyString,
} from '../../middleware/validation.ts';
import { createRateLimiter } from '../../middleware/rateLimiter.ts';

/**
 * Modules: Rooms & Game Engine REST interface (src/server/modules/rooms/roomsRouter.ts)
 */
export function createRoomsRouter(
  repo: IDataRepository,
  arena: ArenaRealtimeManager,
  requireAuth: any
): Router {
  const router = Router();

  const answerRateLimiter = createRateLimiter({
    windowMs: 10 * 1000,
    maxRequests: 40,
    keyPrefix: 'room_answer',
    message: 'Gửi câu trả lời quá nhanh. Vui lòng chờ câu hỏi tiếp theo.',
  });

  router.get('/active', requireAuth, (_req: AuthenticatedRequest, res) => {
    res.json({ rooms: arena.listActivePublicRooms() });
  });

  router.post('/', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const {
        questionSetId,
        title,
        description,
        classroomId,
        questionLimit,
        timeLimitOverrideSec,
        pointsOverride,
        gameMode,
        maxParticipants,
        accessPolicy,
        isPublic,
        isTestMode,
        isTeamMode,
        teamCount,
        teamPlayFormat,
        customTeams,
        revealAnswersPolicy,
        publicLeaderboardPolicy,
        allowRejoinPolicy,
        maxAttemptsPerPlayer,
      } = req.body || {};
      const testMode = Boolean(isTestMode);

      if (!testMode && req.user!.role === 'STUDENT') {
        throw new ApiValidationError(
          'Học sinh chỉ có thể khởi tạo "Lượt chơi thử nghiệm" hoặc tham gia phòng bằng mã PIN.',
          403
        );
      }

      const targetSetId =
        typeof questionSetId === 'string' && questionSetId.trim()
          ? questionSetId.trim()
          : repo.listQuestionSets()[0]?.id;

      if (!targetSetId) {
        throw new ApiValidationError('Chưa có bộ câu hỏi nào để tạo phòng.', 400);
      }

      const roomState = arena.createRoom({
        host: req.user!,
        questionSetId: targetSetId,
        title: typeof title === 'string' ? title : undefined,
        description: typeof description === 'string' ? description : undefined,
        classroomId: typeof classroomId === 'string' && classroomId ? classroomId : null,
        questionLimit:
          typeof questionLimit === 'number' && questionLimit > 0 ? questionLimit : undefined,
        timeLimitOverrideSec:
          typeof timeLimitOverrideSec === 'number' && timeLimitOverrideSec > 0
            ? timeLimitOverrideSec
            : null,
        pointsOverride:
          typeof pointsOverride === 'number' && pointsOverride > 0 ? pointsOverride : null,
        gameMode: gameMode as GameMode | undefined,
        maxParticipants:
          typeof maxParticipants === 'number' && maxParticipants > 0
            ? maxParticipants
            : undefined,
        accessPolicy: accessPolicy as RoomAccessPolicy | undefined,
        isPublic: typeof isPublic === 'boolean' ? isPublic : true,
        isTestMode: testMode,
        isTeamMode: Boolean(isTeamMode),
        teamCount: typeof teamCount === 'number' ? teamCount : undefined,
        teamPlayFormat: teamPlayFormat as TeamPlayFormat | undefined,
        revealAnswersPolicy:
          revealAnswersPolicy === 'END_OF_MATCH' ? 'END_OF_MATCH' : 'IMMEDIATE',
        publicLeaderboardPolicy:
          typeof publicLeaderboardPolicy === 'boolean' ? publicLeaderboardPolicy : true,
        allowRejoinPolicy:
          typeof allowRejoinPolicy === 'boolean' ? allowRejoinPolicy : true,
        maxAttemptsPerPlayer:
          typeof maxAttemptsPerPlayer === 'number' ? maxAttemptsPerPlayer : 1,
      });

      res.status(201).json({ room: roomState });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:code/teams', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const room = arena.configureRoomTeams(req.params.code, req.user!, req.body || {});
      res.json({ room });
    } catch (err) {
      next(err);
    }
  });

  router.post('/join', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const { code, displayName } = req.body || {};
      const validCode = requireNonEmptyString(code, 'Mã PIN phòng thi đấu', 4, 12);
      const room = arena.joinRoomByCode(
        validCode,
        req.user!,
        typeof displayName === 'string' ? displayName : undefined
      );
      res.json({ room });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:code/leave', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const room = arena.leaveRoom(req.params.code, req.user!);
      res.json({ room });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:code', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const room = arena.getRoomState(req.params.code);
      if (!room) {
        throw new ApiValidationError('Không tìm thấy phòng thi đấu.', 404);
      }
      res.json({ room });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:code/next', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const room = arena.startRoomOrNextQuestion(req.params.code, req.user!);
      res.json({ room });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:code/reveal', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const room = arena.forceRevealQuestion(req.params.code, req.user!);
      res.json({ room });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:code/pause', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const room = arena.pauseRoom(req.params.code, req.user!);
      res.json({ room });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:code/resume', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const room = arena.resumeRoom(req.params.code, req.user!);
      res.json({ room });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:code/end', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const room = arena.endRoom(req.params.code, req.user!);
      res.json({ room });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:code/lock', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const { isJoinLocked } = req.body || {};
      const room = arena.toggleRoomJoinLock(
        req.params.code,
        req.user!,
        typeof isJoinLocked === 'boolean' ? isJoinLocked : undefined
      );
      res.json({ room });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/:code/answer',
    requireAuth,
    answerRateLimiter,
    (req: AuthenticatedRequest, res, next) => {
      try {
        const { selectedIndex, selectedIndices, questionId, sessionId } = req.body || {};
        const room = arena.submitAnswer(req.params.code, req.user!, {
          selectedIndex: typeof selectedIndex === 'number' ? selectedIndex : undefined,
          selectedIndices: Array.isArray(selectedIndices) ? selectedIndices : undefined,
          questionId: typeof questionId === 'string' ? questionId : undefined,
          sessionId: typeof sessionId === 'string' ? sessionId : undefined,
        });
        res.json({ room });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
