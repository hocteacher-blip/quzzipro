import React, { useState } from 'react';
import { X, ShieldAlert, UserCheck, KeyRound, CheckCircle2 } from 'lucide-react';
import { api } from '../services/apiClient.ts';
import type { UserProfile } from '../types/arena.ts';

interface AuthModalProps {
  initialTab: 'LOGIN' | 'REGISTER' | 'CLAIM_ADMIN' | 'FORGOT_PASSWORD';
  adminInitialized: boolean;
  passcodeConfigured: boolean;
  onClose: () => void;
  onSuccess: (token: string, user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  initialTab,
  adminInitialized,
  passcodeConfigured,
  onClose,
  onSuccess,
}) => {
  const [tab, setTab] = useState<'LOGIN' | 'REGISTER' | 'CLAIM_ADMIN' | 'FORGOT_PASSWORD'>(
    initialTab
  );
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'TEACHER' | 'STUDENT'>('TEACHER');
  const [schoolName, setSchoolName] = useState('');
  const [className, setClassName] = useState('');
  const [adminPasscode, setAdminPasscode] = useState('');

  // Forgot Password flow state
  const [resetStep, setResetStep] = useState<'REQUEST' | 'VERIFY'>('REQUEST');
  const [resetCode, setResetCode] = useState('');
  const [newResetPassword, setNewResetPassword] = useState('');
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetNotice(null);
    setLoading(true);
    try {
      if (tab === 'LOGIN') {
        const res = await api.login({ email, password });
        onSuccess(res.token, res.user);
      } else if (tab === 'REGISTER') {
        const res = await api.register({
          email,
          username: username.trim() || undefined,
          fullName,
          password,
          role,
          schoolName,
          className: className.trim() || undefined,
        });
        onSuccess(res.token, res.user);
      } else if (tab === 'CLAIM_ADMIN') {
        const res = await api.claimAdmin({
          email,
          fullName,
          password,
          adminPasscode: adminPasscode || undefined,
        });
        onSuccess(res.token, res.user);
      } else if (tab === 'FORGOT_PASSWORD') {
        if (resetStep === 'REQUEST') {
          const res = await api.requestPasswordReset(email);
          setResetNotice(res.message);
          if (res.sandboxResetCode) {
            setResetCode(res.sandboxResetCode);
          }
          setResetStep('VERIFY');
        } else {
          const res = await api.resetPassword({
            email,
            resetCode,
            newPassword: newResetPassword,
          });
          onSuccess(res.token, res.user);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Đã xảy ra lỗi xác thực.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSession = async (demoRole: 'TEACHER' | 'STUDENT') => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.startDemoSession(demoRole);
      onSuccess(res.token, res.user);
    } catch (err: any) {
      setError(err?.message || 'Không thể khởi tạo phiên trải nghiệm.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              {tab === 'LOGIN' && 'Đăng nhập hệ thống'}
              {tab === 'REGISTER' && 'Đăng ký tài khoản mới'}
              {tab === 'CLAIM_ADMIN' && 'Khởi tạo Quản trị viên hệ thống'}
              {tab === 'FORGOT_PASSWORD' && 'Khôi phục mật khẩu tài khoản'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              QUIZZI ARENA PRO — Xác thực bảo mật &amp; điều hướng tự động theo phân quyền
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            aria-label="Đóng hộp thoại"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Interactive Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg mb-5">
          <button
            type="button"
            onClick={() => {
              setTab('LOGIN');
              setError(null);
            }}
            className={`flex-1 py-1.5 px-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              tab === 'LOGIN'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('REGISTER');
              setError(null);
            }}
            className={`flex-1 py-1.5 px-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              tab === 'REGISTER'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đăng ký
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('FORGOT_PASSWORD');
              setResetStep('REQUEST');
              setError(null);
            }}
            className={`flex-1 py-1.5 px-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              tab === 'FORGOT_PASSWORD'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Quên MK
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('CLAIM_ADMIN');
              setError(null);
            }}
            className={`flex-1 py-1.5 px-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              tab === 'CLAIM_ADMIN'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Admin
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {resetNotice && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{resetNotice}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {(tab === 'REGISTER' || tab === 'CLAIM_ADMIN') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên hiển thị
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="VD: Nguyễn Văn An"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên đăng nhập
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="VD: nguyenvanan"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {tab === 'LOGIN' ? 'Địa chỉ Email hoặc Tên đăng nhập' : 'Địa chỉ Email'}
            </label>
            <input
              type={tab === 'LOGIN' ? 'text' : 'email'}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={
                tab === 'LOGIN' ? 'name@school.edu.vn hoặc username' : 'name@school.edu.vn'
              }
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {tab !== 'FORGOT_PASSWORD' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Mật khẩu (tối thiểu 6 ký tự)
                </label>
                {tab === 'LOGIN' && (
                  <button
                    type="button"
                    onClick={() => {
                      setTab('FORGOT_PASSWORD');
                      setResetStep('REQUEST');
                      setError(null);
                    }}
                    className="text-xs font-semibold text-amber-700 hover:underline"
                  >
                    Quên mật khẩu?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          )}

          {tab === 'FORGOT_PASSWORD' && resetStep === 'VERIFY' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mã xác nhận khôi phục (6 chữ số)
                </label>
                <input
                  type="text"
                  required
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  placeholder="Nhập mã 6 số..."
                  className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mật khẩu mới (tối thiểu 6 ký tự)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newResetPassword}
                  onChange={(e) => setNewResetPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </>
          )}

          {tab === 'REGISTER' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Vai trò tham gia
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('TEACHER')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors ${
                      role === 'TEACHER'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Giáo viên
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('STUDENT')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors ${
                      role === 'STUDENT'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Học sinh
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Trường học / Đơn vị
                  </label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="VD: THPT Chuyên..."
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lớp / Tổ bộ môn
                  </label>
                  <input
                    type="text"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="VD: Lớp 12A1"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </>
          )}

          {tab === 'CLAIM_ADMIN' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-2">
              {!adminInitialized && !passcodeConfigured ? (
                <p>
                  <strong>Khởi tạo Quản trị viên lần đầu:</strong> Hệ thống chưa có Quản trị viên. Bạn có thể thiết lập tài khoản Quản trị viên đầu tiên ngay bây giờ. Sau khi tạo, chức năng này sẽ tự động khóa để bảo mật.
                </p>
              ) : (
                <>
                  <p>
                    Nhập mã <code className="font-mono">ADMIN_SETUP_PASSCODE</code> đã cấu hình trên máy chủ để tạo mới tài khoản Quản trị viên:
                  </p>
                  <input
                    type="password"
                    value={adminPasscode}
                    onChange={(e) => setAdminPasscode(e.target.value)}
                    placeholder="Nhập ADMIN_SETUP_PASSCODE..."
                    className="w-full px-3 py-1.5 text-sm bg-white border border-amber-300 rounded-md focus:outline-none"
                  />
                </>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
          >
            {tab === 'FORGOT_PASSWORD' && <KeyRound className="w-4 h-4" />}
            <span>
              {loading
                ? 'Đang xử lý...'
                : tab === 'LOGIN'
                ? 'Đăng nhập'
                : tab === 'REGISTER'
                ? 'Tạo tài khoản & Vào đấu trường'
                : tab === 'CLAIM_ADMIN'
                ? 'Xác nhận khởi tạo Quản trị viên'
                : resetStep === 'REQUEST'
                ? 'Nhận mã xác nhận khôi phục 6 số'
                : 'Đặt lại mật khẩu & Đăng nhập'}
            </span>
          </button>
        </form>

        {/* Instant Demo Evaluation Switcher */}
        <div className="mt-6 pt-5 border-t border-slate-200">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-3">
            <UserCheck className="w-4 h-4 text-amber-600" />
            <span>Đăng nhập nhanh tài khoản trải nghiệm có sẵn dữ liệu:</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleDemoSession('TEACHER')}
              className="py-2 px-3 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Giáo viên mẫu
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleDemoSession('STUDENT')}
              className="py-2 px-3 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Học sinh mẫu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
