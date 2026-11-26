import { Router } from 'express';
import type { AuthenticatedRequest } from '../../auth.ts';
import type { IDataRepository } from '../../repository.ts';
import { parsePagination } from '../../middleware/validation.ts';

/**
 * Module: Leaderboard (src/server/modules/leaderboard/leaderboardRouter.ts)
 */
export function createLeaderboardRouter(repo: IDataRepository, requireAuth: any): Router {
  const router = Router();

  router.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
    const { limit } = parsePagination(req, 30, 100);
    const leaderboard = repo.getLeaderboard(limit);
    res.json({ leaderboard });
  });

  return router;
}
