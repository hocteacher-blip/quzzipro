import { Router } from 'express';
import type { AuthenticatedRequest } from '../../auth.ts';
import type { IDataRepository } from '../../repository.ts';
import type { ArenaRealtimeManager } from '../../arenaManager.ts';
import { parsePagination } from '../../middleware/validation.ts';

/**
 * Module: Reports, Match History & Role Dashboards (src/server/modules/reports/reportsRouter.ts)
 */
export function createReportsRouter(
  repo: IDataRepository,
  requireAuth: any,
  arena?: ArenaRealtimeManager
): Router {
  const router = Router();

  router.get('/dashboard/role-summary', requireAuth, (req: AuthenticatedRequest, res) => {
    const activeRooms = arena ? arena.getActiveRoomCount() : 0;
    const summary = repo.getRoleDashboardSummary(req.user!, activeRooms);
    res.json({ summary });
  });

  router.get('/history', requireAuth, (req: AuthenticatedRequest, res) => {
    const { page, limit } = parsePagination(req, 30, 100);
    const result = repo.listMatchHistory(req.user!.id, page, limit);
    res.json({
      history: result.history,
      pagination: result.pagination,
    });
  });

  router.get('/history/:matchId/submissions', requireAuth, (req: AuthenticatedRequest, res) => {
    const details = repo.getMatchSubmissionDetails(req.params.matchId, req.user!.id);
    res.json({ submissions: details });
  });

  router.get('/reports/summary', requireAuth, (_req: AuthenticatedRequest, res) => {
    const summary = repo.getReportSummary();
    res.json({ summary });
  });

  return router;
}
