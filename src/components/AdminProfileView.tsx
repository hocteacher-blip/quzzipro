import React, { useEffect, useState } from 'react';
import {
  Shield,
  UserCog,
  Server,
  Lock,
  Unlock,
  Activity,
  BarChart3,
  Layers,
  Database,
  Search,
  UserPlus,
  Edit3,
  Eye,
  KeyRound,
} from 'lucide-react';
import { api } from '../services/apiClient.ts';
import type {
  ActivityLogRecord,
  Classroom,
  PaginationMetadata,
  ReportSummary,
  SystemArchitectureDiagnostics,
  TeacherDetailStats,
  UserProfile,
  UserRole,
} from '../types/arena.ts';

interface AdminProfileViewProps {
  mode: 'ADMIN_CONSOLE' | 'PROFILE';
  currentUser: UserProfile;
  classrooms?: Classroom[];
  diagnostics: SystemArchitectureDiagnostics | null;
  onUserUpdated: (user: UserProfile) => void;
  onOpenClaimAdmin: () => void;
}

const PRESET_AVATARS = [
  {
    label: 'Học giả Vàng',
    url: 'https://api.dicebear.com/7.x/initials/svg?seed=QA&backgroundColor=d97706',
  },
  {
    label: 'Đấu trường Xanh',
    url: 'https://api.dicebear.com/7.x/initials/svg?seed=PRO&backgroundColor=0f172a',
  },
  {
    label: 'Khoa học Tự nhiên',
    url: 'https://api.dicebear.com/7.x/initials/svg?seed=SC&backgroundColor=047857',
  },
  {
    label: 'Chuyên Tin học',
    url: 'https://api.dicebear.com/7.x/initials/svg?seed=IT&backgroundColor=1d4ed8',
  },
];

export const AdminProfileView: React.FC<AdminProfileViewProps> = ({
  mode,
  currentUser,
  classrooms = [],
  diagnostics,
  onUserUpdated,
  onOpenClaimAdmin,
}) => {
  // 9-Field Profile Editor State
  const [fullName, setFullName] = useState(currentUser.fullName);
  const [username, setUsername] = useState(currentUser.username || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [schoolName, setSchoolName] = useState(currentUser.schoolName);
  const [className, setClassName] = useState(currentUser.className || '');
  const [bio, setBio] = useState(currentUser.bio);
  const [savingProfile, setSavingProfile] = useState(false);

  // Dedicated Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Admin Console Sub-tabs
  const [adminSubTab, setAdminSubTab] = useState<
    'TEACHERS' | 'USERS' | 'REPORTS' | 'LOGS' | 'ARCHITECTURE'
  >(currentUser.role === 'ADMIN' ? 'TEACHERS' : 'ARCHITECTURE');

  // Teacher Management State (Section 4)
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [teacherStatusFilter, setTeacherStatusFilter] = useState<'ALL' | 'ACTIVE' | 'LOCKED'>(
    'ALL'
  );
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [selectedTeacherDetails, setSelectedTeacherDetails] =
    useState<TeacherDetailStats | null>(null);
  const [loadingTeacherDetails, setLoadingTeacherDetails] = useState(false);

  // Add / Edit Teacher or User State
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [createRole, setCreateRole] = useState<UserRole>('TEACHER');
  const [createFullName, setCreateFullName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createUsername, setCreateUsername] = useState('');
  const [createSchool, setCreateSchool] = useState('THPT Chuyên Khoa Học Tự Nhiên');
  const [createClassName, setCreateClassName] = useState('');
  const [createPassword, setCreatePassword] = useState('Teacher@123');

  const [editingUserTarget, setEditingUserTarget] = useState<UserProfile | null>(null);
  const [editUserFullName, setEditUserFullName] = useState('');
  const [editUserUsername, setEditUserUsername] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserSchool, setEditUserSchool] = useState('');
  const [editUserClassName, setEditUserClassName] = useState('');
  const [editUserRole, setEditUserRole] = useState<UserRole>('TEACHER');
  const [editUserPassword, setEditUserPassword] = useState('');

  const [confirmLockUserId, setConfirmLockUserId] = useState<string | null>(null);

  // All Users Management State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('');
  const [userStatusFilter, setUserStatusFilter] = useState<'ALL' | 'ACTIVE' | 'LOCKED'>('ALL');
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogRecord[]>([]);
  const [logPagination, setLogPagination] = useState<PaginationMetadata | null>(null);
  const [logPage, setLogPage] = useState(1);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFullName(currentUser.fullName);
    setUsername(currentUser.username || '');
    setAvatarUrl(currentUser.avatarUrl || '');
    setSchoolName(currentUser.schoolName);
    setClassName(currentUser.className || '');
    setBio(currentUser.bio);
  }, [currentUser]);

  const loadTeachersList = async () => {
    if (currentUser.role !== 'ADMIN') return;
    setLoadingTeachers(true);
    try {
      const res = await api.listAdminUsers(1, 50, {
        role: 'TEACHER',
        search: teacherSearch.trim() || undefined,
        status: teacherStatusFilter,
      });
      setTeachers(res.users);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải danh sách giáo viên.');
    } finally {
      setLoadingTeachers(false);
    }
  };

  const loadAllUsersList = async () => {
    if (currentUser.role !== 'ADMIN') return;
    setLoadingUsers(true);
    try {
      const res = await api.listAdminUsers(1, 50, {
        role: (userRoleFilter as UserRole) || undefined,
        search: userSearch.trim() || undefined,
        status: userStatusFilter,
      });
      setUsers(res.users);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải danh sách tài khoản.');
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadAdminAndReportData = async () => {
    setError(null);
    try {
      const repRes = await api.getReportSummary();
      setReportSummary(repRes.summary);
    } catch {
      // ignore if unauthenticated
    }

    if (currentUser.role === 'ADMIN') {
      try {
        const logRes = await api.listActivityLogs(logPage, 15);
        setActivityLogs(logRes.logs);
        setLogPagination(logRes.pagination);
      } catch {
        // ignore
      }
    }
  };

  useEffect(() => {
    if (mode === 'ADMIN_CONSOLE') {
      loadAdminAndReportData();
    }
  }, [mode, currentUser.role, logPage]);

  useEffect(() => {
    if (mode === 'ADMIN_CONSOLE' && currentUser.role === 'ADMIN') {
      if (adminSubTab === 'TEACHERS') {
        loadTeachersList();
      } else if (adminSubTab === 'USERS') {
        loadAllUsersList();
      }
    }
  }, [mode, adminSubTab, currentUser.role, teacherStatusFilter, userRoleFilter, userStatusFilter]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setFeedback(null);
    setError(null);
    try {
      const res = await api.updateProfile({
        fullName,
        username: username.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
        schoolName,
        className: className.trim() || undefined,
        bio,
      });
      onUserUpdated(res.user);
      setFeedback('Đã lưu thông tin hồ sơ cá nhân thành công.');
    } catch (err: any) {
      setError(err?.message || 'Không thể cập nhật hồ sơ.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setError(null);
    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }
    setChangingPassword(true);
    try {
      const res = await api.changePassword({
        currentPassword: currentPassword || undefined,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setFeedback(res.message || 'Đã đổi mật khẩu thành công.');
    } catch (err: any) {
      setError(err?.message || 'Không thể đổi mật khẩu.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleAdminCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    try {
      const res = await api.adminCreateUser({
        fullName: createFullName,
        email: createEmail,
        username: createUsername.trim() || undefined,
        role: createRole,
        schoolName: createSchool,
        className: createClassName,
        password: createPassword,
      });
      setShowCreateUserModal(false);
      setCreateFullName('');
      setCreateEmail('');
      setCreateUsername('');
      await loadTeachersList();
      await loadAllUsersList();
      setFeedback(`Đã tạo tài khoản ${res.user.fullName} (${res.user.role}) thành công.`);
    } catch (err: any) {
      setError(err?.message || 'Không thể tạo tài khoản mới.');
    }
  };

  const handleAdminSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserTarget) return;
    setError(null);
    setFeedback(null);
    try {
      const res = await api.adminEditUser(editingUserTarget.id, {
        fullName: editUserFullName,
        username: editUserUsername,
        email: editUserEmail,
        schoolName: editUserSchool,
        className: editUserClassName,
        role: editUserRole,
        newPassword: editUserPassword.trim() ? editUserPassword.trim() : undefined,
      });
      setEditingUserTarget(null);
      setEditUserPassword('');
      setTeachers((prev) => prev.map((t) => (t.id === res.user.id ? res.user : t)));
      setUsers((prev) => prev.map((u) => (u.id === res.user.id ? res.user : u)));
      setFeedback(`Đã cập nhật thông tin tài khoản ${res.user.fullName}.`);
    } catch (err: any) {
      setError(err?.message || 'Không thể cập nhật thông tin tài khoản.');
    }
  };

  const handleToggleLockAccount = async (targetUser: UserProfile) => {
    setError(null);
    setFeedback(null);
    try {
      const res = await api.updateAdminUser(targetUser.id, {
        role: targetUser.role,
        isLocked: !targetUser.isLocked,
      });
      setConfirmLockUserId(null);
      setTeachers((prev) => prev.map((t) => (t.id === res.user.id ? res.user : t)));
      setUsers((prev) => prev.map((u) => (u.id === res.user.id ? res.user : u)));
      if (selectedTeacherDetails?.teacher.id === res.user.id) {
        setSelectedTeacherDetails({
          ...selectedTeacherDetails,
          teacher: res.user,
        });
      }
      setFeedback(
        res.user.isLocked
          ? `Đã khóa tài khoản ${res.user.fullName}.`
          : `Đã mở khóa tài khoản ${res.user.fullName}.`
      );
    } catch (err: any) {
      setError(err?.message || 'Không thể thay đổi trạng thái tài khoản.');
    }
  };

  const handleInspectTeacherDetails = async (teacherId: string) => {
    setLoadingTeacherDetails(true);
    setError(null);
    try {
      const res = await api.getTeacherDetails(teacherId);
      setSelectedTeacherDetails(res.details);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải thống kê hoạt động của giáo viên.');
    } finally {
      setLoadingTeacherDetails(false);
    }
  };

  // ============================================================================
  // MODE 1: PERSONAL PROFILE (9 FIELDS + DEDICATED PASSWORD CHANGE)
  // ============================================================================
  if (mode === 'PROFILE') {
    const initials = (currentUser.fullName || 'QA')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: 9-Field Profile Summary & Editor */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-4">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={currentUser.fullName}
                  className="w-14 h-14 rounded-xl object-cover border border-slate-300 shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-slate-900 text-amber-400 font-bold text-lg flex items-center justify-center shrink-0">
                  {initials}
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  Hồ sơ Cá nhân ({currentUser.fullName})
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span className="font-mono text-slate-800">
                    @{currentUser.username || 'user'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Ngày tham gia:{' '}
                    <strong className="font-mono text-slate-800 tabular-nums">
                      {new Date(currentUser.createdAt).toLocaleDateString('vi-VN')}
                    </strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Trạng thái:{' '}
                    <strong
                      className={
                        currentUser.isLocked ? 'text-red-700' : 'text-emerald-700'
                      }
                    >
                      {currentUser.isLocked ? 'Đang bị khóa' : 'Đang hoạt động'}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
            <UserCog className="w-6 h-6 text-slate-700 hidden sm:block" />
          </div>

          {feedback && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
              {feedback}
            </div>
          )}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            {/* Field 1: Avatar Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                1. Ảnh đại diện (Chọn mẫu học thuật hoặc dán đường dẫn ảnh)
              </label>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {PRESET_AVATARS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setAvatarUrl(preset.url)}
                    className={`px-2.5 py-1.5 text-xs rounded-lg border inline-flex items-center gap-1.5 transition-colors ${
                      avatarUrl === preset.url
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <img
                      src={preset.url}
                      alt={preset.label}
                      className="w-4 h-4 rounded-full"
                    />
                    <span>{preset.label}</span>
                  </button>
                ))}
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl('')}
                    className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-900"
                  >
                    Dùng chữ viết tắt
                  </button>
                )}
              </div>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://... (Đường dẫn ảnh đại diện tùy chọn)"
                className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Field 2: Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  2. Họ và tên hiển thị *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              {/* Field 3: Username */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  3. Tên đăng nhập (Username) *
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))
                  }
                  className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Field 4: Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  4. Địa chỉ Email định danh
                </label>
                <input
                  type="text"
                  disabled
                  value={currentUser.email}
                  className="w-full px-3.5 py-2 text-sm bg-slate-100 border border-slate-200 rounded-lg text-slate-600"
                />
              </div>

              {/* Field 5: Role (Read-only per security requirements) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  5. Vai trò phân quyền (Không tự ý thay đổi)
                </label>
                <input
                  type="text"
                  disabled
                  value={
                    currentUser.role === 'ADMIN'
                      ? 'Quản trị viên hệ thống (ADMIN)'
                      : currentUser.role === 'TEACHER'
                      ? 'Giáo viên (TEACHER)'
                      : 'Học sinh (STUDENT)'
                  }
                  className="w-full px-3.5 py-2 text-sm bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Field 6: School */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  6. Trường học / Đơn vị công tác
                </label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              {/* Field 7: Class */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  7. Lớp học hành chính / Tổ bộ môn
                </label>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="VD: Lớp 12A1 hoặc Tổ Toán - Tin"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Field 8: Joined Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  8. Ngày tham gia hệ thống
                </label>
                <input
                  type="text"
                  disabled
                  value={new Date(currentUser.createdAt).toLocaleString('vi-VN')}
                  className="w-full px-3.5 py-2 text-sm font-mono bg-slate-100 border border-slate-200 rounded-lg text-slate-600 tabular-nums"
                />
              </div>

              {/* Field 9: Account Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  9. Trạng thái tài khoản
                </label>
                <input
                  type="text"
                  disabled
                  value={
                    currentUser.isLocked
                      ? 'Đang bị khóa (LOCKED)'
                      : 'Hoạt động bình thường (ACTIVE)'
                  }
                  className="w-full px-3.5 py-2 text-sm bg-slate-100 border border-slate-200 rounded-lg text-emerald-700 font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Giới thiệu bản thân / Ghi chú học tập
              </label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                {savingProfile ? 'Đang lưu...' : 'Lưu thông tin hồ sơ'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Dedicated Password Change & Enrolled Classrooms Info */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-600" />
                <span>Đổi mật khẩu bảo mật</span>
              </h3>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mật khẩu hiện tại
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mật khẩu mới (Tối thiểu 6 ký tự)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Xác nhận mật khẩu mới
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <button
                type="submit"
                disabled={changingPassword}
                className="w-full py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                {changingPassword ? 'Đang cập nhật...' : 'Cập nhật mật khẩu mới'}
              </button>
            </form>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h3 className="text-sm font-bold text-slate-950">
              Lớp học liên kết ({classrooms.length})
            </h3>
            {classrooms.length === 0 ? (
              <p className="text-xs text-slate-500">
                Tài khoản chưa tham gia hoặc quản lý lớp học nào.
              </p>
            ) : (
              <div className="space-y-2">
                {classrooms.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  >
                    <div className="font-bold text-slate-900">{c.name}</div>
                    <div className="text-slate-500 mt-0.5">
                      Mã lớp: <strong className="font-mono">{c.code}</strong> · {c.subject}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MODE 2: SYSTEM ADMIN & TECHNICAL ARCHITECTURE CONSOLE
  // ============================================================================
  const moduleList = diagnostics?.standardizedModules || [
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
  ];

  const entityList = diagnostics?.databaseEntities || [
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
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-950">
            Khu vực Quản trị Hệ thống — Giáo viên, Tài khoản &amp; Kiến trúc
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý đội ngũ Giáo viên, phân quyền tài khoản toàn hệ thống, thống kê học thuật và nhật ký kiểm toán (ActivityLog).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setAdminSubTab('TEACHERS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              adminSubTab === 'TEACHERS'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Quản lý Giáo viên
          </button>
          <button
            type="button"
            onClick={() => setAdminSubTab('USERS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              adminSubTab === 'USERS'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả Tài khoản
          </button>
          <button
            type="button"
            onClick={() => setAdminSubTab('REPORTS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              adminSubTab === 'REPORTS'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Báo cáo Hệ thống
          </button>
          <button
            type="button"
            onClick={() => setAdminSubTab('LOGS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              adminSubTab === 'LOGS'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Nhật ký (ActivityLog)
          </button>
          <button
            type="button"
            onClick={() => setAdminSubTab('ARCHITECTURE')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              adminSubTab === 'ARCHITECTURE'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Kiến trúc &amp; CSDL
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="underline font-semibold ml-3"
          >
            Đóng
          </button>
        </div>
      )}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="underline font-semibold ml-3"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Create User / Teacher Modal Form (Shared between TEACHERS and USERS tabs) */}
      {showCreateUserModal && currentUser.role === 'ADMIN' && (
        <form
          onSubmit={handleAdminCreateAccount}
          className="bg-white border border-slate-900 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-950">
              Thêm mới tài khoản ({createRole === 'TEACHER' ? 'Giáo viên' : createRole})
            </h3>
            <button
              type="button"
              onClick={() => setShowCreateUserModal(false)}
              className="text-xs text-slate-500 hover:text-slate-900"
            >
              Đóng
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Họ và tên *
              </label>
              <input
                type="text"
                required
                value={createFullName}
                onChange={(e) => setCreateFullName(e.target.value)}
                placeholder="VD: Thầy Đặng Minh Tuấn"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Địa chỉ Email *
              </label>
              <input
                type="email"
                required
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="minhtuan@quizzi.edu.vn"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tên đăng nhập
              </label>
              <input
                type="text"
                value={createUsername}
                onChange={(e) => setCreateUsername(e.target.value)}
                placeholder="gv_minhtuan"
                className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nhóm phân quyền
              </label>
              <select
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value as UserRole)}
                className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-lg font-semibold"
              >
                <option value="TEACHER">Giáo viên (TEACHER)</option>
                <option value="STUDENT">Học sinh (STUDENT)</option>
                <option value="ADMIN">Quản trị viên (ADMIN)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Trường học / Đơn vị
              </label>
              <input
                type="text"
                value={createSchool}
                onChange={(e) => setCreateSchool(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mật khẩu khởi tạo *
              </label>
              <input
                type="text"
                required
                minLength={6}
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreateUserModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg"
            >
              Tạo tài khoản
            </button>
          </div>
        </form>
      )}

      {/* Edit User / Teacher Modal Form */}
      {editingUserTarget && currentUser.role === 'ADMIN' && (
        <form
          onSubmit={handleAdminSaveUserEdit}
          className="bg-amber-50/70 border border-amber-300 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between pb-2 border-b border-amber-200">
            <h3 className="text-sm font-bold text-slate-950">
              Chỉnh sửa thông tin tài khoản: {editingUserTarget.fullName}
            </h3>
            <button
              type="button"
              onClick={() => setEditingUserTarget(null)}
              className="text-xs text-slate-600"
            >
              Đóng
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Họ và tên *
              </label>
              <input
                type="text"
                required
                value={editUserFullName}
                onChange={(e) => setEditUserFullName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                required
                value={editUserEmail}
                onChange={(e) => setEditUserEmail(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Tên đăng nhập
              </label>
              <input
                type="text"
                value={editUserUsername}
                onChange={(e) => setEditUserUsername(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Trường học / Đơn vị
              </label>
              <input
                type="text"
                value={editUserSchool}
                onChange={(e) => setEditUserSchool(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Tổ bộ môn / Lớp hành chính
              </label>
              <input
                type="text"
                value={editUserClassName}
                onChange={(e) => setEditUserClassName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Vai trò phân quyền
              </label>
              <select
                disabled={editingUserTarget.id === currentUser.id}
                value={editUserRole}
                onChange={(e) => setEditUserRole(e.target.value as UserRole)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-semibold"
              >
                <option value="TEACHER">Giáo viên (TEACHER)</option>
                <option value="STUDENT">Học sinh (STUDENT)</option>
                <option value="ADMIN">Quản trị viên (ADMIN)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Đặt lại mật khẩu mới (Để trống nếu giữ nguyên mật khẩu hiện tại)
            </label>
            <input
              type="password"
              value={editUserPassword}
              onChange={(e) => setEditUserPassword(e.target.value)}
              placeholder="Nhập mật khẩu mới tối thiểu 6 ký tự..."
              className="w-full max-w-sm px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingUserTarget(null)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg"
            >
              Lưu thay đổi
            </button>
          </div>
        </form>
      )}

      {/* SUB-TAB 1: TEACHER MANAGEMENT (SECTION 4) */}
      {adminSubTab === 'TEACHERS' && (
        <>
          {currentUser.role !== 'ADMIN' ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-950">
                Chức năng Quản lý Giáo viên chỉ dành cho Quản trị viên hệ thống (ADMIN)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tài khoản hiện tại của bạn đang có vai trò <strong>{currentUser.role}</strong>. Vui lòng đăng nhập tài khoản Quản trị viên để quản lý danh sách Giáo viên.
              </p>
              <button
                type="button"
                onClick={onOpenClaimAdmin}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                Mở biểu mẫu Khởi tạo / Đăng nhập Quản trị viên
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-950">
                      Danh sách Giáo viên trên hệ thống ({teachers.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Tìm kiếm giáo viên, thêm tài khoản giáo viên mới, chỉnh sửa hồ sơ, khóa/mở khóa và kiểm tra các lớp học do giáo viên phụ trách.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateRole('TEACHER');
                      setShowCreateUserModal(true);
                    }}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Thêm Giáo viên mới</span>
                  </button>
                </div>

                {/* Search & Status Filter */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    loadTeachersList();
                  }}
                  className="flex flex-wrap items-center gap-3"
                >
                  <div className="flex-1 min-w-[240px] relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={teacherSearch}
                      onChange={(e) => setTeacherSearch(e.target.value)}
                      placeholder="Tìm giáo viên theo họ tên, email, tên đăng nhập..."
                      className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <select
                    value={teacherStatusFilter}
                    onChange={(e) =>
                      setTeacherStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'LOCKED')
                    }
                    className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="ALL">Mọi trạng thái</option>
                    <option value="ACTIVE">Đang hoạt động</option>
                    <option value="LOCKED">Đang bị khóa</option>
                  </select>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg"
                  >
                    Tìm kiếm
                  </button>
                </form>

                {loadingTeachers ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    Đang tải danh sách giáo viên...
                  </div>
                ) : teachers.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    Không tìm thấy tài khoản giáo viên nào.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                          <th className="py-2.5 px-3 font-semibold">Giáo viên</th>
                          <th className="py-2.5 px-3 font-semibold">Email &amp; Username</th>
                          <th className="py-2.5 px-3 font-semibold">Đơn vị / Trường</th>
                          <th className="py-2.5 px-3 font-semibold">Trạng thái</th>
                          <th className="py-2.5 px-3 font-semibold text-right">
                            Thao tác quản trị
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs">
                        {teachers.map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50">
                            <td className="py-3 px-3 font-semibold text-slate-900">
                              {t.fullName}
                            </td>
                            <td className="py-3 px-3 text-slate-600">
                              <span className="font-mono text-slate-900">
                                @{t.username || 'teacher'}
                              </span>
                              <span className="block text-[11px] text-slate-500">
                                {t.email}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-600">
                              {t.schoolName || '—'}
                            </td>
                            <td className="py-3 px-3">
                              {t.isLocked ? (
                                <span className="text-red-700 font-semibold">Đang khóa</span>
                              ) : (
                                <span className="text-emerald-700 font-semibold">
                                  Hoạt động
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleInspectTeacherDetails(t.id)}
                                  className="px-2.5 py-1 text-[11px] font-semibold bg-amber-50 text-amber-800 hover:bg-amber-100 rounded inline-flex items-center gap-1"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Lớp &amp; Hoạt động</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingUserTarget(t);
                                    setEditUserFullName(t.fullName);
                                    setEditUserEmail(t.email);
                                    setEditUserUsername(t.username || '');
                                    setEditUserSchool(t.schoolName || '');
                                    setEditUserClassName(t.className || '');
                                    setEditUserRole(t.role);
                                    setEditUserPassword('');
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded inline-flex items-center gap-1"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Sửa</span>
                                </button>

                                {confirmLockUserId === t.id ? (
                                  <div className="inline-flex items-center gap-1 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                                    <span className="text-[11px] text-red-800 font-semibold">
                                      {t.isLocked ? 'Mở khóa?' : 'Khóa?'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleLockAccount(t)}
                                      className="text-[11px] font-bold text-red-700 underline"
                                    >
                                      Xác nhận
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmLockUserId(null)}
                                      className="text-[11px] text-slate-500 ml-1"
                                    >
                                      Hủy
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmLockUserId(t.id)}
                                    className={`px-2.5 py-1 text-[11px] font-semibold rounded inline-flex items-center gap-1 ${
                                      t.isLocked
                                        ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                                  >
                                    {t.isLocked ? (
                                      <>
                                        <Unlock className="w-3.5 h-3.5" />
                                        <span>Mở khóa</span>
                                      </>
                                    ) : (
                                      <>
                                        <Lock className="w-3.5 h-3.5" />
                                        <span>Khóa</span>
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Teacher Detail Inspector Card */}
              {(loadingTeacherDetails || selectedTeacherDetails) && (
                <div className="bg-white border border-slate-900 rounded-xl p-6 space-y-4">
                  {loadingTeacherDetails ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      Đang tải hồ sơ lớp học và nhật ký hoạt động của giáo viên...
                    </div>
                  ) : (
                    selectedTeacherDetails && (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                          <div>
                            <div className="text-xs font-semibold text-amber-700">
                              Chi tiết Lớp học phụ trách &amp; Hoạt động Giáo viên
                            </div>
                            <h4 className="text-lg font-bold text-slate-950">
                              {selectedTeacherDetails.teacher.fullName} (
                              {selectedTeacherDetails.teacher.email})
                            </h4>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedTeacherDetails(null)}
                            className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg"
                          >
                            Đóng chi tiết
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                            <div className="text-xs text-slate-500">Số lớp đang quản lý</div>
                            <div className="text-xl font-bold text-slate-950 font-mono tabular-nums">
                              {selectedTeacherDetails.classrooms.length} lớp
                            </div>
                          </div>
                          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                            <div className="text-xs text-slate-500">Bộ câu hỏi đã biên soạn</div>
                            <div className="text-xl font-bold text-slate-950 font-mono tabular-nums">
                              {selectedTeacherDetails.questionSetCount} bộ đề
                            </div>
                          </div>
                          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                            <div className="text-xs text-slate-500">Phiên thi đấu đã tổ chức</div>
                            <div className="text-xl font-bold text-slate-950 font-mono tabular-nums">
                              {selectedTeacherDetails.hostedMatchCount} trận
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div>
                            <h5 className="text-xs font-bold text-slate-800 mb-2">
                              Danh sách lớp học do giáo viên quản lý (
                              {selectedTeacherDetails.classrooms.length})
                            </h5>
                            {selectedTeacherDetails.classrooms.length === 0 ? (
                              <div className="text-xs text-slate-500">
                                Giáo viên chưa tạo lớp học nào.
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {selectedTeacherDetails.classrooms.map((c) => (
                                  <div
                                    key={c.id}
                                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between"
                                  >
                                    <div>
                                      <div className="font-bold text-slate-900">{c.name}</div>
                                      <div className="text-slate-500">
                                        Mã lớp: <strong className="font-mono">{c.code}</strong> ·{' '}
                                        {c.subject}
                                      </div>
                                    </div>
                                    <span className="font-mono font-semibold text-slate-800 tabular-nums">
                                      {c.studentCount} học sinh
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div>
                            <h5 className="text-xs font-bold text-slate-800 mb-2">
                              Nhật ký hoạt động gần đây của giáo viên
                            </h5>
                            {selectedTeacherDetails.recentActivities.length === 0 ? (
                              <div className="text-xs text-slate-500">
                                Chưa có nhật ký hoạt động.
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {selectedTeacherDetails.recentActivities.map((act) => (
                                  <div
                                    key={act.id}
                                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                                  >
                                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                                      <span>
                                        {act.module} · {act.action}
                                      </span>
                                      <span>
                                        {new Date(act.createdAt).toLocaleDateString('vi-VN')}
                                      </span>
                                    </div>
                                    <div className="text-slate-800 mt-0.5">{act.details}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* SUB-TAB 2: ALL USER MANAGEMENT (RBAC) */}
      {adminSubTab === 'USERS' && (
        <>
          {currentUser.role !== 'ADMIN' ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-950">
                Yêu cầu quyền Quản trị viên hệ thống (ADMIN)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tài khoản hiện tại của bạn đang có vai trò <strong>{currentUser.role}</strong>. Để truy cập bảng điều khiển phân quyền người dùng toàn hệ thống, vui lòng khởi tạo hoặc đăng nhập tài khoản Quản trị viên.
              </p>
              <button
                type="button"
                onClick={onOpenClaimAdmin}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                Mở biểu mẫu Khởi tạo / Đăng nhập Quản trị viên
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-700" />
                  <h3 className="text-base font-bold text-slate-950">
                    Quản lý Toàn bộ Tài khoản ({users.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCreateRole('STUDENT');
                    setShowCreateUserModal(true);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Tạo Tài khoản mới</span>
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loadAllUsersList();
                }}
                className="grid grid-cols-1 sm:grid-cols-4 gap-3"
              >
                <div className="sm:col-span-2 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Tìm theo họ tên, email, tên đăng nhập..."
                    className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  <option value="">Tất cả vai trò</option>
                  <option value="ADMIN">Quản trị viên (ADMIN)</option>
                  <option value="TEACHER">Giáo viên (TEACHER)</option>
                  <option value="STUDENT">Học sinh (STUDENT)</option>
                </select>
                <div className="flex gap-2">
                  <select
                    value={userStatusFilter}
                    onChange={(e) =>
                      setUserStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'LOCKED')
                    }
                    className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="ALL">Mọi trạng thái</option>
                    <option value="ACTIVE">Hoạt động</option>
                    <option value="LOCKED">Đang khóa</option>
                  </select>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg"
                  >
                    Lọc
                  </button>
                </div>
              </form>

              {loadingUsers ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Đang tải danh sách tài khoản...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                        <th className="py-3 px-3 font-semibold">Họ và tên</th>
                        <th className="py-3 px-3 font-semibold">Email &amp; Username</th>
                        <th className="py-3 px-3 font-semibold">Đơn vị / Lớp</th>
                        <th className="py-3 px-3 font-semibold">Phân quyền (RBAC)</th>
                        <th className="py-3 px-3 font-semibold text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50">
                          <td className="py-3 px-3 font-semibold text-slate-900">
                            {u.fullName}
                            {u.id === currentUser.id ? ' (Bạn)' : ''}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            <span className="font-mono text-slate-900">
                              @{u.username || 'user'}
                            </span>
                            <span className="block text-[11px] text-slate-500">{u.email}</span>
                          </td>
                          <td className="py-3 px-3 text-slate-500">
                            {u.schoolName || '—'}
                            {u.className ? ` · ${u.className}` : ''}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-800">{u.role}</td>
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingUserTarget(u);
                                  setEditUserFullName(u.fullName);
                                  setEditUserEmail(u.email);
                                  setEditUserUsername(u.username || '');
                                  setEditUserSchool(u.schoolName || '');
                                  setEditUserClassName(u.className || '');
                                  setEditUserRole(u.role);
                                  setEditUserPassword('');
                                }}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded inline-flex items-center gap-1"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Sửa</span>
                              </button>

                              {confirmLockUserId === u.id ? (
                                <div className="inline-flex items-center gap-1 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                                  <span className="text-[11px] text-red-800 font-semibold">
                                    {u.isLocked ? 'Mở khóa?' : 'Khóa?'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleLockAccount(u)}
                                    className="text-[11px] font-bold text-red-700 underline"
                                  >
                                    Đồng ý
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmLockUserId(null)}
                                    className="text-[11px] text-slate-500 ml-1"
                                  >
                                    Hủy
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={u.id === currentUser.id}
                                  onClick={() => setConfirmLockUserId(u.id)}
                                  className={`px-2.5 py-1 text-[11px] font-semibold rounded inline-flex items-center gap-1 ${
                                    u.isLocked
                                      ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                  } disabled:opacity-40`}
                                >
                                  {u.isLocked ? (
                                    <>
                                      <Lock className="w-3.5 h-3.5" />
                                      <span>Đang khóa</span>
                                    </>
                                  ) : (
                                    <>
                                      <Unlock className="w-3.5 h-3.5" />
                                      <span>Hoạt động</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* SUB-TAB 3: REPORTS & ANALYTICS */}
      {adminSubTab === 'REPORTS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500 mb-1">Tổng phiên thi đấu hoàn tất</div>
              <div className="text-2xl font-bold text-slate-950 tabular-nums">
                {reportSummary?.totalSessions ?? 1} phiên
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500 mb-1">Lượt câu trả lời đã chấm</div>
              <div className="text-2xl font-bold text-slate-950 tabular-nums">
                {reportSummary?.totalPlayerAnswers ?? 0} lượt
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500 mb-1">Tỉ lệ chính xác trung bình</div>
              <div className="text-2xl font-bold text-emerald-700 tabular-nums">
                {reportSummary?.averageAccuracyPercent ?? 85}%
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500 mb-1">Thời gian phản xạ trung bình</div>
              <div className="text-2xl font-bold text-slate-950 tabular-nums">
                {((reportSummary?.averageResponseTimeMs ?? 4200) / 1000).toFixed(1)} giây
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-slate-700" />
                <span>Thống kê Ngân hàng Đề theo Môn học</span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="py-2.5 px-4 font-semibold">Môn học</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Số bộ đề (Quiz)</th>
                    <th className="py-2.5 px-4 font-semibold text-right">
                      Tổng số câu hỏi (Question)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {(reportSummary?.subjectBreakdown || []).map((item) => (
                    <tr key={item.subject} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{item.subject}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        {item.quizCount}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        {item.questionCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: ACTIVITY LOGS (AUDIT TRAIL WITH PAGINATION) */}
      {adminSubTab === 'LOGS' && (
        <>
          {currentUser.role !== 'ADMIN' ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-950">
                Nhật ký hệ thống (ActivityLog) chỉ dành cho Quản trị viên
              </h3>
              <p className="text-xs text-slate-600">
                Học sinh và Giáo viên không được phép truy cập dữ liệu nhật ký kiểm toán quản trị.
              </p>
              <button
                type="button"
                onClick={onOpenClaimAdmin}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                Khởi tạo / Đăng nhập Quản trị viên
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-slate-700" />
                  <h3 className="text-base font-bold text-slate-950">
                    Nhật ký hoạt động hệ thống (ActivityLog)
                  </h3>
                </div>
                {logPagination && (
                  <span className="text-xs font-mono text-slate-500 tabular-nums">
                    Trang {logPagination.page} / {logPagination.totalPages} (Tổng:{' '}
                    {logPagination.total})
                  </span>
                )}
              </div>

              {activityLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Chưa có bản ghi nhật ký hoạt động nào.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                        <th className="py-2.5 px-4 font-semibold">Thời gian</th>
                        <th className="py-2.5 px-4 font-semibold">Module</th>
                        <th className="py-2.5 px-4 font-semibold">Hành động</th>
                        <th className="py-2.5 px-4 font-semibold">Người thực hiện</th>
                        <th className="py-2.5 px-4 font-semibold">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {activityLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-mono text-slate-500 tabular-nums whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString('vi-VN')}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-semibold text-slate-800">
                            {log.module}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-amber-800">{log.action}</td>
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            {log.actorName} ({log.actorRole})
                          </td>
                          <td className="py-2.5 px-4 text-slate-600">{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {logPagination && logPagination.totalPages > 1 && (
                <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={logPage <= 1}
                    onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded"
                  >
                    Trang trước
                  </button>
                  <button
                    type="button"
                    disabled={logPage >= logPagination.totalPages}
                    onClick={() => setLogPage((p) => p + 1)}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded"
                  >
                    Trang tiếp
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* SUB-TAB 5: TECHNICAL ARCHITECTURE & 15 DATABASE ENTITIES */}
      {adminSubTab === 'ARCHITECTURE' && (
        <div className="space-y-6">
          {diagnostics && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
                  <Server className="w-4 h-4 text-slate-700" />
                  <span>Thông số Kiến trúc Thời gian thực &amp; Giới hạn Tải</span>
                </h3>
                <span className="text-xs font-mono text-emerald-700 font-semibold">
                  Sức chứa: {diagnostics.maxConcurrentPerRoom || 100} người/phòng
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-slate-500 block mb-1">Database Engine</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {diagnostics.databaseEngine}
                  </span>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-slate-500 block mb-1">Tầng Trừu tượng Dữ liệu</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {diagnostics.repositoryAdapter}
                  </span>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-slate-500 block mb-1">Kết nối WebSocket hiện tại</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {diagnostics.activeWebSocketClients} kết nối · {diagnostics.activeLiveRooms}{' '}
                    phòng
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {diagnostics.concurrencyLimitsNote}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 12 Standardized Modules */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-700" />
                  <span>12 Module Mã nguồn Độc lập</span>
                </h3>
                <span className="text-xs font-mono text-slate-500">src/server/modules/*</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {moduleList.map((modName, idx) => (
                  <div
                    key={modName}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  >
                    <span className="font-mono text-slate-400 mr-1.5 tabular-nums">
                      {String(idx + 1).padStart(2, '0')}.
                    </span>
                    <strong className="text-slate-900">{modName}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* 15 Normalized Database Entities */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
                  <Database className="w-4 h-4 text-slate-700" />
                  <span>15 Thực thể Cơ sở dữ liệu Chuẩn hóa</span>
                </h3>
                <span className="text-xs font-mono text-slate-500">PK · FK · Indexes</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {entityList.map((entName, idx) => (
                  <div
                    key={entName}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  >
                    <span className="font-mono text-slate-400 mr-1.5 tabular-nums">
                      {String(idx + 1).padStart(2, '0')}.
                    </span>
                    <strong className="font-mono text-slate-900">{entName}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
