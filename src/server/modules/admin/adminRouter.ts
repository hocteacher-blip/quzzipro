import { Router } from 'express';
import { hashPassword, type AuthenticatedRequest } from '../../auth.ts';
import type { IDataRepository } from '../../repository.ts';
import { ArenaRealtimeManager } from '../../arenaManager.ts';
import type { SystemArchitectureDiagnostics, UserRole } from '../../../types/arena.ts';
import {
  ApiValidationError,
  parsePagination,
  requireNonEmptyString,
} from '../../middleware/validation.ts';

/**
 * Module: Admin, Teacher Management & System Diagnostics (src/server/modules/admin/adminRouter.ts)
 */
export function createAdminRouter(
  repo: IDataRepository,
  arena: ArenaRealtimeManager,
  requireAuth: any,
  requireRole: any
): Router {
  const router = Router();

  router.get(
    '/admin/users',
    requireAuth,
    requireRole(['ADMIN']),
    (req: AuthenticatedRequest, res) => {
      const { page, limit } = parsePagination(req, 50, 100);
      const roleParam = req.query.role as UserRole | undefined;
      const validRole =
        roleParam && ['ADMIN', 'TEACHER', 'STUDENT'].includes(roleParam) ? roleParam : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const statusRaw = typeof req.query.status === 'string' ? req.query.status : 'ALL';
      const status =
        statusRaw === 'ACTIVE' || statusRaw === 'LOCKED' ? statusRaw : ('ALL' as const);

      const result = repo.listAllUsers(page, limit, {
        role: validRole,
        search,
        status,
      });
      res.json({
        users: result.users,
        pagination: result.pagination,
      });
    }
  );

  router.post(
    '/admin/users',
    requireAuth,
    requireRole(['ADMIN']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const { email, username, fullName, password, role, schoolName, className, bio } =
          req.body || {};
        const validEmail = requireNonEmptyString(email, 'Địa chỉ Email', 4, 150);
        if (!validEmail.includes('@')) {
          throw new ApiValidationError('Vui lòng nhập địa chỉ Email hợp lệ.');
        }
        const validName = requireNonEmptyString(fullName, 'Họ và tên', 2, 120);
        const validPassword = requireNonEmptyString(password, 'Mật khẩu khởi tạo', 6, 128);

        if (repo.getStoredUserByEmail(validEmail)) {
          throw new ApiValidationError('Email này đã tồn tại trên hệ thống.', 409);
        }

        const assignedRole: UserRole = ['ADMIN', 'TEACHER', 'STUDENT'].includes(role)
          ? role
          : 'TEACHER';

        const created = repo.createUser({
          email: validEmail,
          username: typeof username === 'string' ? username : undefined,
          fullName: validName,
          passwordHash: hashPassword(validPassword),
          role: assignedRole,
          schoolName: typeof schoolName === 'string' ? schoolName : '',
          className: typeof className === 'string' ? className : '',
          bio: typeof bio === 'string' ? bio : '',
        });

        repo.logActivity({
          actorId: req.user!.id,
          actorName: req.user!.fullName,
          actorRole: req.user!.role,
          action: 'ADMIN_USER_CREATED',
          module: 'Admin',
          targetId: created.id,
          details: `Admin tạo tài khoản ${created.email} (Vai trò: ${created.role})`,
        });

        res.status(201).json({ user: created });
      } catch (err) {
        next(err);
      }
    }
  );

  router.put(
    '/admin/users/:userId',
    requireAuth,
    requireRole(['ADMIN']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const {
          fullName,
          username,
          email,
          schoolName,
          className,
          bio,
          role,
          isLocked,
          newPassword,
        } = req.body || {};

        if (req.params.userId === req.user!.id && (isLocked || (role && role !== 'ADMIN'))) {
          throw new ApiValidationError(
            'Không thể tự khóa hoặc hạ quyền tài khoản Quản trị viên đang đăng nhập.',
            400
          );
        }

        let passwordHash: string | undefined;
        if (typeof newPassword === 'string' && newPassword.trim().length > 0) {
          if (newPassword.trim().length < 6) {
            throw new ApiValidationError('Mật khẩu đặt lại phải có ít nhất 6 ký tự.');
          }
          passwordHash = hashPassword(newPassword.trim());
        }

        const updated = repo.adminUpdateUser(req.params.userId, {
          fullName: typeof fullName === 'string' ? fullName : undefined,
          username: typeof username === 'string' ? username : undefined,
          email: typeof email === 'string' ? email : undefined,
          schoolName: typeof schoolName === 'string' ? schoolName : undefined,
          className: typeof className === 'string' ? className : undefined,
          bio: typeof bio === 'string' ? bio : undefined,
          role:
            role && ['ADMIN', 'TEACHER', 'STUDENT'].includes(role) ? (role as UserRole) : undefined,
          isLocked: typeof isLocked === 'boolean' ? isLocked : undefined,
          passwordHash,
        });

        if (!updated) {
          throw new ApiValidationError('Không tìm thấy tài khoản người dùng.', 404);
        }

        repo.logActivity({
          actorId: req.user!.id,
          actorName: req.user!.fullName,
          actorRole: req.user!.role,
          action: 'ADMIN_USER_EDITED',
          module: 'Admin',
          targetId: updated.id,
          details: `Admin chỉnh sửa thông tin tài khoản ${updated.email} (Quyền=${updated.role}, Khóa=${updated.isLocked})`,
        });

        res.json({ user: updated });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    '/admin/teachers/:teacherId/details',
    requireAuth,
    requireRole(['ADMIN']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const stats = repo.getTeacherDetailStats(req.params.teacherId);
        if (!stats) {
          throw new ApiValidationError('Không tìm thấy thông tin giáo viên.', 404);
        }
        res.json({ details: stats });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    '/admin/roles',
    requireAuth,
    requireRole(['ADMIN']),
    (_req: AuthenticatedRequest, res) => {
      res.json({ roles: repo.listRoles() });
    }
  );

  router.get(
    '/admin/activity-logs',
    requireAuth,
    requireRole(['ADMIN']),
    (req: AuthenticatedRequest, res) => {
      const { page, limit } = parsePagination(req, 20, 100);
      const result = repo.listActivityLogs(page, limit);
      res.json({
        logs: result.logs,
        pagination: result.pagination,
      });
    }
  );

  router.patch(
    '/admin/users/:userId',
    requireAuth,
    requireRole(['ADMIN']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const { role, isLocked } = req.body || {};
        const validRoles: UserRole[] = ['ADMIN', 'TEACHER', 'STUDENT'];
        if (!validRoles.includes(role)) {
          throw new ApiValidationError('Vai trò không hợp lệ.', 400);
        }
        if (req.params.userId === req.user!.id && (isLocked || role !== 'ADMIN')) {
          throw new ApiValidationError(
            'Không thể tự khóa hoặc hạ quyền tài khoản Quản trị viên đang đăng nhập.',
            400
          );
        }
        const updated = repo.updateUserRoleOrLock(req.params.userId, role, Boolean(isLocked));
        if (!updated) {
          throw new ApiValidationError('Không tìm thấy người dùng.', 404);
        }

        repo.logActivity({
          actorId: req.user!.id,
          actorName: req.user!.fullName,
          actorRole: req.user!.role,
          action: 'ADMIN_USER_UPDATED',
          module: 'Admin',
          targetId: updated.id,
          details: `Cập nhật tài khoản ${updated.email}: Quyền=${updated.role}, Khóa=${updated.isLocked}`,
        });

        res.json({ user: updated });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get('/system/diagnostics', (_req, res) => {
    const counts = repo.getSystemCounts();
    const diagnostics: SystemArchitectureDiagnostics = {
      databaseEngine: repo.getEngineName(),
      repositoryAdapter: 'IDataRepository (15 Thực thể Chuẩn hóa + Chỉ mục SQL)',
      realtimeEngine:
        'Node.js WebSocket (ws) — Heartbeat 25s + Debounced 40ms Broadcast (100 người/phòng)',
      maxConcurrentPerRoom: ArenaRealtimeManager.MAX_CONCURRENT_PER_ROOM,
      activeWebSocketClients: arena.getActiveClientCount(),
      activeLiveRooms: arena.getActiveRoomCount(),
      totalUsers: counts.totalUsers,
      totalQuestionSets: counts.totalQuestionSets,
      totalQuestions: counts.totalQuestions,
      totalMatchesCompleted: counts.totalMatchesCompleted,
      totalActivityLogs: counts.totalActivityLogs,
      standardizedModules: [
        'Authentication',
        'Users',
        'Roles',
        'Classes',
        'Questions',
        'Quiz',
        'Rooms',
        'Game Engine',
        'Scoring',
        'Leaderboard',
        'Reports',
        'Admin',
      ],
      databaseEntities: [
        'User',
        'Role',
        'Class',
        'ClassMember',
        'Question',
        'QuestionOption',
        'Quiz',
        'QuizQuestion',
        'GameRoom',
        'GameParticipant',
        'GameSession',
        'PlayerAnswer',
        'Score',
        'Leaderboard',
        'ActivityLog',
      ],
      adminInitialized: repo.isAdminInitialized(),
      concurrencyLimitsNote:
        'Kiến trúc 12 Module độc lập & 15 Thực thể CSDL có khóa ngoại/chỉ mục. Bộ điều phối thời gian thực hỗ trợ tối đa 100 người chơi đồng thời/phòng nhờ gom nhóm gói tin phát sóng (40ms debounce), kiểm tra kết nối Heartbeat (25s), đồng bộ trạng thái tự động khi mất kết nối và khóa chống gửi đáp án trùng lặp ở cả bộ nhớ lẫn CSDL.',
    };
    res.json({ diagnostics });
  });

  return router;
}
