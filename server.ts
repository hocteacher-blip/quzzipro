import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import { createAuthMiddleware, verifyAuthToken } from './src/server/auth.ts';
import { SqliteDataRepository } from './src/server/repository.ts';
import { ArenaRealtimeManager } from './src/server/arenaManager.ts';
import { createRateLimiter } from './src/server/middleware/rateLimiter.ts';
import { centralizedErrorHandler } from './src/server/middleware/errorHandler.ts';
import { createAuthRouter } from './src/server/modules/authentication/authRouter.ts';
import { createUsersRouter } from './src/server/modules/users/usersRouter.ts';
import { createClassesRouter } from './src/server/modules/classes/classesRouter.ts';
import { createQuestionsAndQuizRouter } from './src/server/modules/questions/questionsRouter.ts';
import { createRoomsRouter } from './src/server/modules/rooms/roomsRouter.ts';
import { createLeaderboardRouter } from './src/server/modules/leaderboard/leaderboardRouter.ts';
import { createReportsRouter } from './src/server/modules/reports/reportsRouter.ts';
import { createAdminRouter } from './src/server/modules/admin/adminRouter.ts';
import { GamificationAndModesService } from './src/server/modules/gamification/gamificationService.ts';
import { createGamificationRouter } from './src/server/modules/gamification/gamificationRouter.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '15mb' }));

  const repo = new SqliteDataRepository();
  const arena = new ArenaRealtimeManager(repo);
  const gamification = new GamificationAndModesService(repo);
  arena.setOnMatchCompletedCallback((payload) => {
    gamification.handleLiveMatchCompletion(payload);
  });

  const { requireAuth, requireRole } = createAuthMiddleware((id) => repo.getUserById(id));

  // Global API Rate Limiter (protects against abuse while allowing 100 concurrent players)
  const apiRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 240,
    keyPrefix: 'global_api',
  });
  app.use('/api', apiRateLimiter);

  // ============================================================================
  // MOUNT STANDARDIZED DOMAIN MODULES
  // ============================================================================
  const authRouter = createAuthRouter(repo, requireAuth);
  const usersRouter = createUsersRouter(repo, requireAuth, requireRole);

  app.use('/api/auth', authRouter);
  // Keep backward-compatible /api/auth/profile alongside /api/users/*
  app.use('/api/auth', usersRouter);
  app.use('/api/users', usersRouter);

  app.use('/api/classrooms', createClassesRouter(repo, requireAuth, requireRole));
  app.use('/api', createQuestionsAndQuizRouter(repo, requireAuth, requireRole));
  app.use('/api/rooms', createRoomsRouter(repo, arena, requireAuth));
  app.use('/api/leaderboard', createLeaderboardRouter(repo, requireAuth));
  app.use('/api/gamification', createGamificationRouter(gamification, requireAuth, requireRole));
  app.use('/api', createReportsRouter(repo, requireAuth, arena));
  app.use('/api', createAdminRouter(repo, arena, requireAuth, requireRole));

  // Centralized Error Handler Middleware
  app.use(centralizedErrorHandler);

  // ============================================================================
  // WEBSOCKET SERVER ATTACHMENT ON PORT 3000 (100+ CONCURRENT PLAYERS)
  // ============================================================================
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const urlObj = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (urlObj.pathname !== '/ws') {
      return;
    }

    const token = urlObj.searchParams.get('token') || '';
    const payload = verifyAuthToken(token);
    if (!payload) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const user = repo.getUserById(payload.userId);
    if (!user || user.isLocked) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      arena.attachWebSocketClient(ws, user);
    });
  });

  // ============================================================================
  // VITE DEV MIDDLEWARE OR PRODUCTION STATIC ASSETS
  // ============================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`QUIZZI ARENA PRO running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
