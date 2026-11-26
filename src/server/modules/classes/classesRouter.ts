import { Router } from 'express';
import type { AuthenticatedRequest } from '../../auth.ts';
import type { IDataRepository } from '../../repository.ts';
import { ApiValidationError, requireNonEmptyString } from '../../middleware/validation.ts';

/**
 * Module: Classes (src/server/modules/classes/classesRouter.ts)
 */
export function createClassesRouter(
  repo: IDataRepository,
  requireAuth: any,
  requireRole: any
): Router {
  const router = Router();

  const assertCanManageClassroom = (req: AuthenticatedRequest, classroomTeacherId: string) => {
    if (req.user!.role === 'ADMIN') return;
    if (req.user!.role === 'TEACHER' && classroomTeacherId === req.user!.id) {
      return;
    }
    throw new ApiValidationError(
      'Truy cập bị từ chối: Giáo viên không được phép chỉnh sửa dữ liệu lớp học của giáo viên khác.',
      403
    );
  };

  router.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
    const classrooms = repo.listClassrooms(req.user!);
    res.json({ classrooms });
  });

  router.post(
    '/',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const { name, subject, gradeLevel, description, customCode } = req.body || {};
        const validName = requireNonEmptyString(name, 'Tên lớp học', 3, 150);
        const validSubject = requireNonEmptyString(subject, 'Môn học', 2, 100);

        if (customCode && typeof customCode === 'string' && customCode.trim()) {
          const existingCode = repo.getClassroomByCode(customCode.trim());
          if (existingCode) {
            throw new ApiValidationError(
              `Mã lớp "${customCode.toUpperCase()}" đã được sử dụng. Vui lòng chọn mã khác.`,
              409
            );
          }
        }

        const classroom = repo.createClassroom({
          name: validName,
          subject: validSubject,
          gradeLevel:
            typeof gradeLevel === 'string' && gradeLevel.trim() ? gradeLevel.trim() : 'THPT',
          description: typeof description === 'string' ? description.slice(0, 300) : '',
          teacherId: req.user!.id,
          customCode: typeof customCode === 'string' ? customCode : undefined,
        });

        repo.logActivity({
          actorId: req.user!.id,
          actorName: req.user!.fullName,
          actorRole: req.user!.role,
          action: 'CLASS_CREATED',
          module: 'Classes',
          targetId: classroom.code,
          details: `Tạo lớp học "${classroom.name}" (Mã: ${classroom.code})`,
        });

        res.status(201).json({ classroom });
      } catch (err) {
        next(err);
      }
    }
  );

  router.patch(
    '/:id',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const classroom = repo.getClassroomById(req.params.id);
        if (!classroom) {
          throw new ApiValidationError('Không tìm thấy lớp học.', 404);
        }
        assertCanManageClassroom(req, classroom.teacherId);

        const { name, subject, gradeLevel, description, isLocked, regenerateCode } = req.body || {};
        const updated = repo.updateClassroom(classroom.id, {
          name: typeof name === 'string' ? name : undefined,
          subject: typeof subject === 'string' ? subject : undefined,
          gradeLevel: typeof gradeLevel === 'string' ? gradeLevel : undefined,
          description: typeof description === 'string' ? description : undefined,
          isLocked: typeof isLocked === 'boolean' ? isLocked : undefined,
          regenerateCode: Boolean(regenerateCode),
        });

        repo.logActivity({
          actorId: req.user!.id,
          actorName: req.user!.fullName,
          actorRole: req.user!.role,
          action: 'CLASS_UPDATED',
          module: 'Classes',
          targetId: updated!.code,
          details: `Cập nhật lớp "${updated!.name}" (Khóa=${updated!.isLocked})`,
        });

        res.json({ classroom: updated });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/:id/add-student',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const classroom = repo.getClassroomById(req.params.id);
        if (!classroom) {
          throw new ApiValidationError('Không tìm thấy lớp học.', 404);
        }
        assertCanManageClassroom(req, classroom.teacherId);

        const { identifier } = req.body || {};
        const validIdent = requireNonEmptyString(
          identifier,
          'Email hoặc Tên đăng nhập học sinh',
          2,
          150
        );

        let student = repo.getStoredUserByEmail(validIdent);
        if (!student) {
          student = repo.getStoredUserByUsername(validIdent);
        }
        if (!student) {
          const byId = repo.getUserById(validIdent);
          if (byId) student = repo.getStoredUserById(byId.id);
        }

        if (!student) {
          throw new ApiValidationError(
            `Không tìm thấy tài khoản học sinh "${validIdent}".`,
            404
          );
        }

        if (repo.isStudentInClassroom(classroom.id, student.id)) {
          throw new ApiValidationError(
            `Học sinh ${student.fullName} đã có trong danh sách lớp này.`,
            409
          );
        }

        repo.joinClassroom(classroom.id, student.id);
        const members = repo.listClassroomMembers(classroom.id);
        const updatedClass = repo.getClassroomById(classroom.id);

        repo.logActivity({
          actorId: req.user!.id,
          actorName: req.user!.fullName,
          actorRole: req.user!.role,
          action: 'CLASS_MEMBER_ADDED',
          module: 'Classes',
          targetId: classroom.code,
          details: `Thêm học sinh ${student.fullName} vào lớp ${classroom.name}`,
        });

        res.json({ classroom: updatedClass, members });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post('/join', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const { code } = req.body || {};
      const validCode = requireNonEmptyString(code, 'Mã lớp học', 2, 32);
      const classroom = repo.getClassroomByCode(validCode);
      if (!classroom) {
        throw new ApiValidationError(
          `Mã lớp "${validCode.toUpperCase()}" không tồn tại. Vui lòng kiểm tra lại.`,
          404
        );
      }

      if (classroom.isLocked) {
        throw new ApiValidationError(
          `Lớp học "${classroom.name}" hiện đang tạm khóa tiếp nhận thành viên mới.`,
          403
        );
      }

      if (repo.isStudentInClassroom(classroom.id, req.user!.id)) {
        throw new ApiValidationError(
          `Bạn đã tham gia lớp "${classroom.name}" (Mã: ${classroom.code}) trước đó.`,
          409
        );
      }

      repo.joinClassroom(classroom.id, req.user!.id);
      const updated = repo.getClassroomById(classroom.id);

      repo.logActivity({
        actorId: req.user!.id,
        actorName: req.user!.fullName,
        actorRole: req.user!.role,
        action: 'CLASS_JOINED',
        module: 'Classes',
        targetId: classroom.code,
        details: `Gia nhập lớp học "${classroom.name}"`,
      });

      res.json({ classroom: updated });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id/members', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const classroom = repo.getClassroomById(req.params.id);
      if (!classroom) {
        throw new ApiValidationError('Không tìm thấy lớp học.', 404);
      }
      const members = repo.listClassroomMembers(classroom.id);
      res.json({ classroom, members });
    } catch (err) {
      next(err);
    }
  });

  router.delete(
    '/:id/members/:studentId',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const classroom = repo.getClassroomById(req.params.id);
        if (!classroom) {
          throw new ApiValidationError('Không tìm thấy lớp học.', 404);
        }
        assertCanManageClassroom(req, classroom.teacherId);

        repo.removeStudentFromClassroom(classroom.id, req.params.studentId);
        const members = repo.listClassroomMembers(classroom.id);

        repo.logActivity({
          actorId: req.user!.id,
          actorName: req.user!.fullName,
          actorRole: req.user!.role,
          action: 'CLASS_MEMBER_REMOVED',
          module: 'Classes',
          targetId: classroom.code,
          details: `Xóa học sinh ID=${req.params.studentId} khỏi lớp ${classroom.name}`,
        });

        res.json({ members });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
