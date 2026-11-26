import { Router } from 'express';
import { hashPassword, type AuthenticatedRequest } from '../../auth.ts';
import type { IDataRepository } from '../../repository.ts';
import type { StudentImportRowInput } from '../../../types/arena.ts';
import {
  ApiValidationError,
  parsePagination,
  requireNonEmptyString,
} from '../../middleware/validation.ts';

/**
 * Module: Users & Student Management (src/server/modules/users/usersRouter.ts)
 */
export function createUsersRouter(
  repo: IDataRepository,
  requireAuth: any,
  requireRole?: any
): Router {
  const router = Router();

  // 1. Personal Profile Update (Strictly prevents self-changing role or lock state)
  const updateProfileHandler = (req: AuthenticatedRequest, res: any, next: any) => {
    try {
      const { fullName, username, avatarUrl, schoolName, className, bio, newPassword } =
        req.body || {};
      const validName = requireNonEmptyString(fullName, 'Họ và tên', 2, 120);

      let passwordHash: string | undefined;
      if (newPassword && typeof newPassword === 'string' && newPassword.trim().length > 0) {
        if (newPassword.length < 6) {
          throw new ApiValidationError('Mật khẩu mới phải có ít nhất 6 ký tự.');
        }
        passwordHash = hashPassword(newPassword);
      }

      // Validate avatarUrl if provided (block javascript: and data: schemes)
      let safeAvatarUrl = '';
      if (typeof avatarUrl === 'string' && avatarUrl.trim()) {
        const trimmed = avatarUrl.trim();
        if (
          trimmed.startsWith('https://') ||
          trimmed.startsWith('http://') ||
          trimmed.startsWith('/src/assets/')
        ) {
          safeAvatarUrl = trimmed.slice(0, 300);
        } else {
          throw new ApiValidationError('Đường dẫn ảnh đại diện phải bắt đầu bằng https:// hoặc http://');
        }
      }

      const updated = repo.updateUserProfile(req.user!.id, {
        fullName: validName,
        username: typeof username === 'string' ? username.slice(0, 60) : undefined,
        avatarUrl: safeAvatarUrl,
        schoolName: typeof schoolName === 'string' ? schoolName.slice(0, 150) : '',
        className: typeof className === 'string' ? className.slice(0, 100) : undefined,
        bio: typeof bio === 'string' ? bio.slice(0, 400) : '',
        passwordHash,
      });

      repo.logActivity({
        actorId: req.user!.id,
        actorName: req.user!.fullName,
        actorRole: req.user!.role,
        action: 'USER_PROFILE_UPDATED',
        module: 'Users',
        targetId: req.user!.id,
        details: 'Cập nhật thông tin hồ sơ cá nhân',
      });

      res.json({ user: updated });
    } catch (err) {
      next(err);
    }
  };

  router.put('/profile', requireAuth, updateProfileHandler);
  router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.user });
  });

  if (!requireRole) {
    return router;
  }

  // ============================================================================
  // 2. STUDENT MANAGEMENT FOR TEACHER & ADMIN (Section 5)
  // ============================================================================

  router.get(
    '/students',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res) => {
      const { page, limit } = parsePagination(req, 30, 100);
      const search = typeof req.query.search === 'string' ? req.query.search : '';
      const classroomId = typeof req.query.classroomId === 'string' ? req.query.classroomId : 'ALL';
      const statusRaw = typeof req.query.status === 'string' ? req.query.status : 'ALL';
      const status =
        statusRaw === 'ACTIVE' || statusRaw === 'LOCKED' ? statusRaw : ('ALL' as const);

      const result = repo.listStudentsForActor(req.user!, {
        search,
        classroomId,
        status,
        page,
        limit,
      });
      res.json(result);
    }
  );

  router.post(
    '/students',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const { fullName, email, username, schoolName, classroomId, password } = req.body || {};
        const validName = requireNonEmptyString(fullName, 'Họ và tên học sinh', 2, 120);
        const validEmail = requireNonEmptyString(email, 'Email học sinh', 4, 150);
        if (!validEmail.includes('@')) {
          throw new ApiValidationError('Địa chỉ Email học sinh không hợp lệ.');
        }

        const existing = repo.getStoredUserByEmail(validEmail);
        if (existing) {
          throw new ApiValidationError('Email học sinh này đã tồn tại trên hệ thống.', 409);
        }

        let targetClassroomName = '';
        if (classroomId && typeof classroomId === 'string') {
          const cls = repo.getClassroomById(classroomId);
          if (!cls) {
            throw new ApiValidationError('Lớp học được chọn không tồn tại.', 404);
          }
          if (req.user!.role === 'TEACHER' && cls.teacherId !== req.user!.id) {
            throw new ApiValidationError(
              'Bạn không có quyền thêm học sinh vào lớp của giáo viên khác.',
              403
            );
          }
          targetClassroomName = cls.name;
        }

        const rawPass =
          typeof password === 'string' && password.trim().length >= 6
            ? password.trim()
            : 'Quizzi@123';

        const created = repo.createUser({
          email: validEmail,
          username: typeof username === 'string' ? username : undefined,
          fullName: validName,
          passwordHash: hashPassword(rawPass),
          role: 'STUDENT',
          schoolName:
            typeof schoolName === 'string' && schoolName.trim()
              ? schoolName.trim()
              : req.user!.schoolName || 'Trường THPT',
          className: targetClassroomName,
        });

        if (classroomId && typeof classroomId === 'string') {
          repo.joinClassroom(classroomId, created.id);
        }

        repo.logActivity({
          actorId: req.user!.id,
          actorName: req.user!.fullName,
          actorRole: req.user!.role,
          action: 'STUDENT_CREATED',
          module: 'Users',
          targetId: created.id,
          details: `Thêm học sinh ${created.fullName} (${created.email})`,
        });

        res.status(201).json({ student: created });
      } catch (err) {
        next(err);
      }
    }
  );

  router.put(
    '/students/:studentId',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const target = repo.getUserById(req.params.studentId);
        if (!target || target.role !== 'STUDENT') {
          throw new ApiValidationError('Không tìm thấy hồ sơ học sinh.', 404);
        }

        const { fullName, username, schoolName, className, bio, isLocked, newPassword } =
          req.body || {};

        let passwordHash: string | undefined;
        if (typeof newPassword === 'string' && newPassword.trim().length > 0) {
          if (newPassword.trim().length < 6) {
            throw new ApiValidationError('Mật khẩu mới phải có ít nhất 6 ký tự.');
          }
          passwordHash = hashPassword(newPassword.trim());
        }

        const updated = repo.adminUpdateUser(target.id, {
          fullName: typeof fullName === 'string' ? fullName : undefined,
          username: typeof username === 'string' ? username : undefined,
          schoolName: typeof schoolName === 'string' ? schoolName : undefined,
          className: typeof className === 'string' ? className : undefined,
          bio: typeof bio === 'string' ? bio : undefined,
          isLocked: typeof isLocked === 'boolean' ? isLocked : undefined,
          passwordHash,
        });

        repo.logActivity({
          actorId: req.user!.id,
          actorName: req.user!.fullName,
          actorRole: req.user!.role,
          action: 'STUDENT_UPDATED',
          module: 'Users',
          targetId: target.id,
          details: `Cập nhật hồ sơ học sinh ${target.fullName}`,
        });

        res.json({ student: updated });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/students/:studentId/transfer-class',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const { fromClassroomId, toClassroomId } = req.body || {};
        const validToId = requireNonEmptyString(toClassroomId, 'Lớp học đích', 2, 64);

        const targetClass = repo.getClassroomById(validToId);
        if (!targetClass) {
          throw new ApiValidationError('Không tìm thấy lớp học đích.', 404);
        }
        if (req.user!.role === 'TEACHER' && targetClass.teacherId !== req.user!.id) {
          throw new ApiValidationError(
            'Bạn chỉ có thể chuyển học sinh vào lớp do chính mình phụ trách.',
            403
          );
        }

        repo.transferStudentClassroom(
          req.params.studentId,
          typeof fromClassroomId === 'string' ? fromClassroomId : null,
          validToId
        );

        repo.logActivity({
          actorId: req.user!.id,
          actorName: req.user!.fullName,
          actorRole: req.user!.role,
          action: 'STUDENT_TRANSFERRED',
          module: 'Classes',
          targetId: req.params.studentId,
          details: `Chuyển học sinh sang lớp ${targetClass.name} (${targetClass.code})`,
        });

        res.json({ success: true, targetClassroom: targetClass });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    '/students/:studentId/achievements',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const detail = repo.getStudentAchievementDetail(req.params.studentId);
        if (!detail) {
          throw new ApiValidationError('Không tìm thấy dữ liệu thành tích học sinh.', 404);
        }
        res.json({ achievement: detail });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/students/bulk-import',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const { rows } = req.body || {};
        if (!Array.isArray(rows) || rows.length === 0) {
          throw new ApiValidationError('Danh sách học sinh cần nhập đang trống.');
        }
        if (rows.length > 200) {
          throw new ApiValidationError('Mỗi lần nhập tối đa 200 học sinh.');
        }

        const sanitizedRows: StudentImportRowInput[] = rows.map((r: any, idx: number) => ({
          rowNumber: Number(r.rowNumber) || idx + 1,
          fullName: String(r.fullName || ''),
          email: String(r.email || ''),
          username: r.username ? String(r.username) : undefined,
          schoolName: r.schoolName ? String(r.schoolName) : req.user!.schoolName,
          classroomCode: r.classroomCode ? String(r.classroomCode) : undefined,
          password: r.password ? String(r.password) : undefined,
        }));

        const result = repo.bulkImportStudents(sanitizedRows, hashPassword);

        repo.logActivity({
          actorId: req.user!.id,
          actorName: req.user!.fullName,
          actorRole: req.user!.role,
          action: 'STUDENTS_BULK_IMPORTED',
          module: 'Users',
          targetId: 'bulk_csv',
          details: `Nhập danh sách CSV: Tạo mới ${result.importedCount}, Ghi danh ${result.enrolledCount}, Bỏ qua ${result.skippedCount}`,
        });

        res.json({ result });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
