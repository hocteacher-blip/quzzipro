import { Router } from 'express';
import type { AuthenticatedRequest } from '../../auth.ts';
import type { GamificationAndModesService } from './gamificationService.ts';
import { ApiValidationError } from '../../middleware/validation.ts';

export function createGamificationRouter(
  gamification: GamificationAndModesService,
  requireAuth: any,
  requireRole: any
): Router {
  const router = Router();

  // 1. Game Center Modes Catalog + User XP Profile + Badges + Missions + Daily Challenge summary
  router.get('/hub', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const user = req.user!;
      res.json({
        modes: gamification.getGameCenterModes(),
        xpProfile: gamification.getUserXpProfile(user.id),
        badges: gamification.listAllBadgeDefinitions(user.id),
        missions: gamification.getUserMissions(user.id),
        dailyChallenge: gamification.getDailyChallengeInfo(user),
        bookmarks: gamification.listBookmarkedQuestions(user.id),
        classAssignments: gamification.listClassAssignments(user),
        tournaments: gamification.listTournaments(),
      });
    } catch (err) {
      next(err);
    }
  });

  // 2. XP Profile & Badges
  router.get('/xp-profile', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const targetUserId =
        typeof req.query.userId === 'string' && req.query.userId.trim()
          ? req.query.userId.trim()
          : req.user!.id;
      res.json({
        xpProfile: gamification.getUserXpProfile(targetUserId),
        badges: gamification.listAllBadgeDefinitions(targetUserId),
        missions: gamification.getUserMissions(targetUserId),
      });
    } catch (err) {
      next(err);
    }
  });

  // 3. Admin Badge Definition Management (Section XII)
  router.patch(
    '/badges/:code',
    requireAuth,
    requireRole(['ADMIN']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const badge = gamification.updateBadgeDefinitionByAdmin(
          req.params.code,
          req.body || {}
        );
        res.json({ badge });
      } catch (err) {
        next(err);
      }
    }
  );

  // 4. Claim Learning Mission Reward (Section XIV)
  router.post(
    '/missions/:code/claim',
    requireAuth,
    (req: AuthenticatedRequest, res, next) => {
      try {
        const result = gamification.claimMissionReward(req.user!.id, req.params.code);
        res.json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // 5. Practice Bookmarks (Section VI)
  router.get('/bookmarks', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      res.json({ bookmarks: gamification.listBookmarkedQuestions(req.user!.id) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/bookmarks', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const { questionId, note } = req.body || {};
      if (!questionId || typeof questionId !== 'string') {
        throw new ApiValidationError('Thiếu mã câu hỏi cần đánh dấu.', 400);
      }
      const result = gamification.toggleBookmarkQuestion(
        req.user!.id,
        questionId,
        typeof note === 'string' ? note : undefined
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // 6. Start Interactive Mode Session (Modes 2, 4, 5, 6, 7, 8)
  router.post('/sessions/start', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const session = gamification.startInteractiveModeSession(req.user!, req.body || {});
      res.status(201).json({ session });
    } catch (err) {
      next(err);
    }
  });

  // 7. Immediate Check for Free Practice Mode (Mode 4)
  router.post(
    '/sessions/:sessionId/check',
    requireAuth,
    (req: AuthenticatedRequest, res, next) => {
      try {
        const { questionId, selectedIndex } = req.body || {};
        if (!questionId || typeof selectedIndex !== 'number') {
          throw new ApiValidationError('Dữ liệu kiểm tra đáp án không hợp lệ.', 400);
        }
        const checkResult = gamification.checkPracticeAnswerImmediate(
          req.user!,
          req.params.sessionId,
          questionId,
          selectedIndex
        );
        res.json(checkResult);
      } catch (err) {
        next(err);
      }
    }
  );

  // 8. Submit & Score Interactive Session on Backend
  router.post(
    '/sessions/:sessionId/submit',
    requireAuth,
    (req: AuthenticatedRequest, res, next) => {
      try {
        const { answers } = req.body || {};
        if (!Array.isArray(answers)) {
          throw new ApiValidationError('Danh sách câu trả lời không hợp lệ.', 400);
        }
        const result = gamification.submitInteractiveModeSession(
          req.user!,
          req.params.sessionId,
          answers
        );
        res.json({ result });
      } catch (err) {
        next(err);
      }
    }
  );

  // 9. Class Competition Assignments (Mode 6)
  router.get('/class-assignments', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const classroomId =
        typeof req.query.classroomId === 'string' ? req.query.classroomId : undefined;
      res.json({
        assignments: gamification.listClassAssignments(req.user!, classroomId),
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/class-assignments', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const assignment = gamification.createClassAssignment(req.user!, req.body || {});
      res.status(201).json({ assignment });
    } catch (err) {
      next(err);
    }
  });

  router.get(
    '/class-assignments/:id/standings',
    requireAuth,
    (req: AuthenticatedRequest, res, next) => {
      try {
        res.json({
          standings: gamification.getClassAssignmentStandings(req.params.id),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.patch(
    '/class-assignments/:id/publish',
    requireAuth,
    (req: AuthenticatedRequest, res, next) => {
      try {
        const { isPublishedResults } = req.body || {};
        const assignment = gamification.toggleAssignmentResultsPublish(
          req.user!,
          req.params.id,
          Boolean(isPublishedResults)
        );
        res.json({ assignment });
      } catch (err) {
        next(err);
      }
    }
  );

  // 10. Daily Challenge (Mode 7)
  router.get('/daily-challenge', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      res.json({ dailyChallenge: gamification.getDailyChallengeInfo(req.user!) });
    } catch (err) {
      next(err);
    }
  });

  // 11. Multi-Round Tournaments (Mode 8)
  router.get('/tournaments', requireAuth, (_req: AuthenticatedRequest, res, next) => {
    try {
      res.json({ tournaments: gamification.listTournaments() });
    } catch (err) {
      next(err);
    }
  });

  router.post('/tournaments', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const tournament = gamification.createTournament(req.user!, req.body || {});
      res.status(201).json({ tournament });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/tournaments/:id/advance',
    requireAuth,
    (req: AuthenticatedRequest, res, next) => {
      try {
        const tournament = gamification.advanceTournamentRound(
          req.user!,
          req.params.id
        );
        res.json({ tournament });
      } catch (err) {
        next(err);
      }
    }
  );

  // 12. Multi-Dimensional Leaderboards (Section XIII)
  router.get('/leaderboards', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const boardType = req.query.boardType as any;
      const metric = req.query.metric as any;
      const classroomId =
        typeof req.query.classroomId === 'string' ? req.query.classroomId : undefined;
      const subject =
        typeof req.query.subject === 'string' ? req.query.subject : undefined;
      const gradeLevel =
        typeof req.query.gradeLevel === 'string' ? req.query.gradeLevel : undefined;
      const anonymizeStudents = req.query.anonymize === 'true';

      const data = gamification.getMultiDimensionalLeaderboard({
        boardType,
        metric,
        classroomId,
        subject,
        gradeLevel,
        anonymizeStudents,
        viewerUserId: req.user!.id,
      });

      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
