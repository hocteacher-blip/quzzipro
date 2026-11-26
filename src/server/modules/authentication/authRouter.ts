import crypto from 'crypto';
import { Router } from 'express';
import {
  hashPassword,
  signAuthToken,
  verifyPassword,
  type AuthenticatedRequest,
} from '../../auth.ts';
import type { IDataRepository } from '../../repository.ts';
import type { UserRole } from '../../../types/arena.ts';
import { createRateLimiter } from '../../middleware/rateLimiter.ts';
import { ApiValidationError, requireNonEmptyString } from '../../middleware/validation.ts';

/**
 * Module: Authentication (src/server/modules/authentication/authRouter.ts)
 */
export function createAuthRouter(repo: IDataRepository, requireAuth: any): Router {
  const router = Router();

  const authRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 35,
    keyPrefix: 'auth_endpoint',
    message: 'Quá nhiều yêu cầu xác thực. Vui lòng thử lại sau 1 phút.',
  });

  router.get('/bootstrap-status', (_req, res) => {
    const passcodeConfigured = Boolean(
      process.env.ADMIN_SETUP_PASSCODE && process.env.ADMIN_SETUP_PASSCODE.trim().length > 0
    );
    res.json({
      adminInitialized: repo.isAdminInitialized(),
      passcodeConfigured,
    });
  });

  router.post('/register', authRateLimiter, (req, res, next) => {
    try {
      const { email, username, fullName, password, role, schoolName, className } = req.body || {};
      const validEmail = requireNonEmptyString(email, 'Địa chỉ Email', 4, 150);
      if (!validEmail.includes('@')) {
        throw new ApiValidationError('Vui lòng nhập địa chỉ email hợp lệ.');
      }
      const validName = requireNonEmptyString(fullName, 'Họ và tên', 2, 120);
      const validPassword = requireNonEmptyString(password, 'Mật khẩu', 6, 128);

      const existing = repo.getStoredUserByEmail(validEmail);
      if (existing) {
        throw new ApiValidationError('Email này đã được đăng ký trong hệ thống.', 409);
      }

      // SECURITY RULE: Users cannot self-elevate to ADMIN via public registration
      const assignedRole: UserRole = role === 'TEACHER' ? 'TEACHER' : 'STUDENT';
      const passwordHash = hashPassword(validPassword);
      const user = repo.createUser({
        email: validEmail,
        username: typeof username === 'string' ? username : undefined,
        fullName: validName,
        passwordHash,
        role: assignedRole,
        schoolName: typeof schoolName === 'string' ? schoolName : '',
        className: typeof className === 'string' ? className : '',
      });

      const token = signAuthToken(user.id, user.role);
      res.status(201).json({ token, user });
    } catch (err) {
      next(err);
    }
  });

  router.post('/login', authRateLimiter, (req, res, next) => {
    try {
      const { email, password } = req.body || {};
      const identifier = requireNonEmptyString(email, 'Email hoặc Tên đăng nhập', 2, 150);
      const validPassword = requireNonEmptyString(password, 'Mật khẩu', 1, 128);

      let stored = repo.getStoredUserByEmail(identifier);
      if (!stored && !identifier.includes('@')) {
        stored = repo.getStoredUserByUsername(identifier);
      }

      if (!stored || !verifyPassword(validPassword, stored.passwordHash)) {
        throw new ApiValidationError('Thông tin đăng nhập hoặc mật khẩu không chính xác.', 401);
      }

      if (stored.isLocked) {
        throw new ApiValidationError('Tài khoản này đã bị khóa bởi Quản trị viên.', 403);
      }

      repo.logActivity({
        actorId: stored.id,
        actorName: stored.fullName,
        actorRole: stored.role,
        action: 'USER_LOGIN',
        module: 'Authentication',
        targetId: stored.id,
        details: 'Đăng nhập thành công vào hệ thống',
      });

      const token = signAuthToken(stored.id, stored.role);
      const { passwordHash: _ph, ...user } = stored;
      res.json({ token, user });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/change-password',
    requireAuth,
    authRateLimiter,
    (req: AuthenticatedRequest, res, next) => {
      try {
        const { currentPassword, newPassword } = req.body || {};
        const validNew = requireNonEmptyString(newPassword, 'Mật khẩu mới', 6, 128);

        const stored = repo.getStoredUserById(req.user!.id);
        if (!stored) {
          throw new ApiValidationError('Không tìm thấy tài khoản.', 404);
        }

        // If account is not a demo account without password, verify currentPassword
        if (stored.passwordHash !== 'DEMO_LOCKED_HASH') {
          const validCur = requireNonEmptyString(currentPassword, 'Mật khẩu hiện tại', 1, 128);
          if (!verifyPassword(validCur, stored.passwordHash)) {
            throw new ApiValidationError('Mật khẩu hiện tại không chính xác.', 401);
          }
        }

        const nextHash = hashPassword(validNew);
        repo.updateUserPassword(stored.id, nextHash);

        repo.logActivity({
          actorId: stored.id,
          actorName: stored.fullName,
          actorRole: stored.role,
          action: 'PASSWORD_CHANGED',
          module: 'Authentication',
          targetId: stored.id,
          details: 'Đổi mật khẩu tài khoản thành công',
        });

        res.json({ success: true, message: 'Đã đổi mật khẩu thành công.' });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post('/request-password-reset', authRateLimiter, (req, res, next) => {
    try {
      const { email } = req.body || {};
      const validEmail = requireNonEmptyString(email, 'Địa chỉ Email khôi phục', 4, 150);

      const resetData = repo.createPasswordResetToken(validEmail);
      if (!resetData) {
        throw new ApiValidationError(
          'Không tìm thấy tài khoản hoạt động với địa chỉ Email này.',
          404
        );
      }

      repo.logActivity({
        actorId: resetData.user.id,
        actorName: resetData.user.fullName,
        actorRole: resetData.user.role,
        action: 'PASSWORD_RESET_REQUESTED',
        module: 'Authentication',
        targetId: resetData.user.email,
        details: 'Yêu cầu mã khôi phục mật khẩu 6 chữ số',
      });

      // Structured note: When SMTP_HOST is not configured in environment, return the token for local sandbox verification
      const smtpConfigured = Boolean(process.env.SMTP_HOST);
      res.json({
        success: true,
        email: resetData.user.email,
        expiresAt: resetData.expiresAt,
        sandboxResetCode: smtpConfigured ? undefined : resetData.resetCode,
        message: smtpConfigured
          ? 'Mã khôi phục 6 số đã được gửi tới hộp thư Email của bạn.'
          : `Chế độ môi trường thử nghiệm (chưa cấu hình SMTP_HOST): Mã xác nhận khôi phục của bạn là ${resetData.resetCode}`,
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/reset-password', authRateLimiter, (req, res, next) => {
    try {
      const { email, resetCode, newPassword } = req.body || {};
      const validEmail = requireNonEmptyString(email, 'Email', 4, 150);
      const validCode = requireNonEmptyString(resetCode, 'Mã xác nhận 6 số', 6, 10);
      const validPassword = requireNonEmptyString(newPassword, 'Mật khẩu mới', 6, 128);

      const newHash = hashPassword(validPassword);
      const user = repo.consumePasswordResetToken(validEmail, validCode, newHash);
      if (!user) {
        throw new ApiValidationError(
          'Mã khôi phục không hợp lệ hoặc đã hết hạn (hiệu lực 15 phút).',
          400
        );
      }

      repo.logActivity({
        actorId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        action: 'PASSWORD_RESET_COMPLETED',
        module: 'Authentication',
        targetId: user.id,
        details: 'Khôi phục mật khẩu thành công bằng mã xác nhận',
      });

      const token = signAuthToken(user.id, user.role);
      res.json({
        token,
        user,
        message: 'Đã đặt lại mật khẩu thành công.',
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/claim-admin', authRateLimiter, (req, res, next) => {
    try {
      const { email, fullName, password, adminPasscode } = req.body || {};
      const validEmail = requireNonEmptyString(email, 'Email Quản trị viên', 4, 150);
      if (!validEmail.includes('@')) {
        throw new ApiValidationError('Vui lòng nhập địa chỉ email quản trị viên hợp lệ.');
      }
      const validName = requireNonEmptyString(fullName, 'Họ tên Quản trị viên', 2, 120);
      const validPassword = requireNonEmptyString(password, 'Mật khẩu Quản trị viên', 6, 128);

      const envPasscode = process.env.ADMIN_SETUP_PASSCODE?.trim();
      const adminAlreadyClaimed = repo.isAdminInitialized();

      if (envPasscode && envPasscode.length > 0) {
        const provided = typeof adminPasscode === 'string' ? adminPasscode.trim() : '';
        const a = Buffer.from(provided);
        const b = Buffer.from(envPasscode);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
          throw new ApiValidationError('Mã xác thực ADMIN_SETUP_PASSCODE không chính xác.', 403);
        }
      } else if (adminAlreadyClaimed) {
        throw new ApiValidationError(
          'Tài khoản Quản trị viên hệ thống đã được khởi tạo trước đó. Vui lòng đăng nhập bằng tài khoản Quản trị viên hoặc cấu hình ADMIN_SETUP_PASSCODE.',
          403
        );
      }

      const existing = repo.getStoredUserByEmail(validEmail);
      if (existing) {
        throw new ApiValidationError(
          'Email này đã tồn tại. Vui lòng chọn email khác cho Quản trị viên.',
          409
        );
      }

      const passwordHash = hashPassword(validPassword);
      const user = repo.createUser({
        email: validEmail,
        fullName: validName,
        passwordHash,
        role: 'ADMIN',
        schoolName: 'Ban Quản Trị Hệ Thống QUIZZI ARENA PRO',
        bio: 'Quản trị viên hệ thống cấp cao.',
      });

      const token = signAuthToken(user.id, user.role);
      res.status(201).json({ token, user });
    } catch (err) {
      next(err);
    }
  });

  router.post('/demo-session', authRateLimiter, (req, res, next) => {
    try {
      const { role } = req.body || {};
      const targetId = role === 'TEACHER' ? 'usr_teacher_demo' : 'usr_student_demo1';
      const user = repo.getUserById(targetId);
      if (!user) {
        throw new ApiValidationError('Không tìm thấy tài khoản trải nghiệm.', 404);
      }
      const token = signAuthToken(user.id, user.role);
      res.json({ token, user });
    } catch (err) {
      next(err);
    }
  });

  router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.user });
  });

  return router;
}
