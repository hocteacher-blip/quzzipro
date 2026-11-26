import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  BookOpen,
  Radio,
  Trophy,
  History,
  Shield,
  UserCog,
  LogOut,
  Play,
  ArrowRight,
  Home,
  Activity,
  Award,
  Gamepad2,
} from 'lucide-react';
import { api, setAuthToken } from './services/apiClient.ts';
import { LandingView } from './components/LandingView.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { LiveArenaRoom } from './components/LiveArenaRoom.tsx';
import { QuestionBankView } from './components/QuestionBankView.tsx';
import { TeacherStudentArea } from './components/TeacherStudentArea.tsx';
import { LeaderboardHistoryView } from './components/LeaderboardHistoryView.tsx';
import { AdminProfileView } from './components/AdminProfileView.tsx';
import { GameCenterView } from './components/GameCenterView.tsx';
import type {
  Classroom,
  GameMode,
  LiveRoomState,
  QuestionSet,
  RoleDashboardSummary,
  RoomAccessPolicy,
  RoomStatus,
  SystemArchitectureDiagnostics,
  UserProfile,
} from './types/arena.ts';

type WorkspaceTab =
  | 'LANDING'
  | 'DASHBOARD'
  | 'GAME_CENTER'
  | 'TEACHER_AREA'
  | 'STUDENT_AREA'
  | 'QUESTION_BANK'
  | 'ARENA_ROOM'
  | 'LEADERBOARD'
  | 'HISTORY'
  | 'ADMIN_CONSOLE'
  | 'PROFILE';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('LANDING');

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialTab, setAuthInitialTab] = useState<
    'LOGIN' | 'REGISTER' | 'CLAIM_ADMIN' | 'FORGOT_PASSWORD'
  >('LOGIN');
  const [adminInitialized, setAdminInitialized] = useState(false);
  const [passcodeConfigured, setPasscodeConfigured] = useState(false);

  const [diagnostics, setDiagnostics] = useState<SystemArchitectureDiagnostics | null>(null);
  const [roleDashboard, setRoleDashboard] = useState<RoleDashboardSummary | null>(null);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [activeRooms, setActiveRooms] = useState<
    Array<{
      id: string;
      code: string;
      title: string;
      questionSetTitle: string;
      hostName: string;
      status: RoomStatus;
      participantCount: number;
      isTestMode: boolean;
    }>
  >([]);
  const [currentLiveRoom, setCurrentLiveRoom] = useState<LiveRoomState | null>(null);
  const [quickPinInput, setQuickPinInput] = useState('');
  const [globalError, setGlobalError] = useState<string | null>(null);

  const refreshSystemStatus = async () => {
    try {
      const [boot, diag] = await Promise.all([
        api.getBootstrapStatus(),
        api.getSystemDiagnostics(),
      ]);
      setAdminInitialized(boot.adminInitialized);
      setPasscodeConfigured(boot.passcodeConfigured);
      setDiagnostics(diag.diagnostics);
    } catch {
      // ignore initial load error
    }
  };

  const refreshWorkspaceData = async () => {
    if (!currentUser) return;
    try {
      const [clsRes, qsRes, roomsRes, diagRes, dashRes] = await Promise.all([
        api.listClassrooms(),
        api.listQuestionSets(),
        api.listActiveRooms(),
        api.getSystemDiagnostics(),
        api.getRoleDashboardSummary(),
      ]);
      setClassrooms(clsRes.classrooms);
      setQuestionSets(qsRes.questionSets);
      setActiveRooms(roomsRes.rooms);
      setDiagnostics(diagRes.diagnostics);
      setRoleDashboard(dashRes.summary);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    refreshSystemStatus();
    const params = new URLSearchParams(window.location.search);
    const sharedRoomPin = params.get('room');
    if (sharedRoomPin && sharedRoomPin.trim()) {
      setQuickPinInput(sharedRoomPin.trim());
      handleQuickJoinPin(sharedRoomPin.trim());
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      refreshWorkspaceData();
    }
  }, [currentUser]);

  const handleAuthSuccess = (token: string, user: UserProfile) => {
    setAuthToken(token);
    setCurrentUser(user);
    setAuthModalOpen(false);
    setGlobalError(null);
    // Automatic role-based routing to the user's personalized dashboard
    if (activeTab === 'LANDING') {
      setActiveTab('DASHBOARD');
    }
    refreshSystemStatus();
  };

  const handleLogout = () => {
    setAuthToken(null);
    setCurrentUser(null);
    setRoleDashboard(null);
    setCurrentLiveRoom(null);
    setActiveTab('LANDING');
  };

  const ensureAuthenticatedOrDemo = async (
    preferredRole: 'TEACHER' | 'STUDENT' = 'STUDENT'
  ): Promise<UserProfile | null> => {
    if (currentUser) return currentUser;
    try {
      const res = await api.startDemoSession(preferredRole);
      setAuthToken(res.token);
      setCurrentUser(res.user);
      return res.user;
    } catch (err: any) {
      setGlobalError(err?.message || 'Vui lòng đăng nhập để tiếp tục.');
      setAuthModalOpen(true);
      return null;
    }
  };

  const handleQuickDemoLogin = async (role: 'TEACHER' | 'STUDENT') => {
    setGlobalError(null);
    try {
      const res = await api.startDemoSession(role);
      handleAuthSuccess(res.token, res.user);
    } catch (err: any) {
      setGlobalError(err?.message || 'Không thể khởi tạo phiên trải nghiệm.');
    }
  };

  const handleQuickJoinPin = async (pin: string, displayName?: string) => {
    setGlobalError(null);
    const user = await ensureAuthenticatedOrDemo('STUDENT');
    if (!user) return;
    try {
      const res = await api.joinRoom(pin, displayName);
      setCurrentLiveRoom(res.room);
      setActiveTab('ARENA_ROOM');
    } catch (err: any) {
      setGlobalError(err?.message || `Không tìm thấy phòng với mã PIN "${pin}".`);
      if (activeTab === 'LANDING') {
        setActiveTab('DASHBOARD');
      }
    }
  };

  const handleCreateAndEnterRoom = async (params: {
    questionSetId?: string;
    title?: string;
    description?: string;
    classroomId?: string | null;
    isTestMode?: boolean;
    questionLimit?: number;
    timeLimitOverrideSec?: number | null;
    pointsOverride?: number | null;
    gameMode?: GameMode;
    maxParticipants?: number;
    accessPolicy?: RoomAccessPolicy;
    isPublic?: boolean;
  }) => {
    setGlobalError(null);
    const user = await ensureAuthenticatedOrDemo(params.isTestMode ? 'STUDENT' : 'TEACHER');
    if (!user) return;
    try {
      const res = await api.createRoom(params);
      setCurrentLiveRoom(res.room);
      setActiveTab('ARENA_ROOM');
      await refreshWorkspaceData();
    } catch (err: any) {
      setGlobalError(err?.message || 'Không thể tạo phòng thi đấu.');
    }
  };

  // If on Landing page, render LandingView
  if (activeTab === 'LANDING') {
    return (
      <>
        <LandingView
          currentUser={currentUser}
          diagnostics={diagnostics}
          onOpenAuth={(tab) => {
            setAuthInitialTab(tab);
            setAuthModalOpen(true);
          }}
          onEnterWorkspace={() => setActiveTab('DASHBOARD')}
          onQuickJoinPin={handleQuickJoinPin}
          onQuickStartDemoMatch={() => handleCreateAndEnterRoom({ isTestMode: true })}
          onQuickDemoLogin={handleQuickDemoLogin}
        />

        {authModalOpen && (
          <AuthModal
            initialTab={authInitialTab}
            adminInitialized={adminInitialized}
            passcodeConfigured={passcodeConfigured}
            onClose={() => setAuthModalOpen(false)}
            onSuccess={handleAuthSuccess}
          />
        )}
      </>
    );
  }

  // Authenticated Workspace Layout (Sidebar + Top Header + Main Viewport)
  const navItems: Array<{
    id: WorkspaceTab;
    label: string;
    icon: React.FC<{ className?: string }>;
  }> = [
    { id: 'DASHBOARD', label: 'Bảng điều khiển', icon: LayoutDashboard },
    { id: 'TEACHER_AREA', label: 'Khu vực Giáo viên', icon: Users },
    { id: 'STUDENT_AREA', label: 'Khu vực Học sinh', icon: GraduationCap },
    { id: 'QUESTION_BANK', label: 'Ngân hàng câu hỏi', icon: BookOpen },
    { id: 'ARENA_ROOM', label: 'Phòng thi đấu', icon: Radio },
    { id: 'LEADERBOARD', label: 'Bảng xếp hạng', icon: Trophy },
    { id: 'HISTORY', label: 'Lịch sử kết quả', icon: History },
    { id: 'ADMIN_CONSOLE', label: 'Khu vực Quản trị', icon: Shield },
    { id: 'PROFILE', label: 'Hồ sơ cá nhân', icon: UserCog },
  ];

  const activeNavLabel =
    navItems.find((i) => i.id === activeTab)?.label || 'Bảng điều khiển';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Sidebar Navigation (260px) */}
      <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 shrink-0 flex flex-col justify-between">
        <div>
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveTab('LANDING')}
              className="text-base font-bold tracking-tight text-slate-950 font-display whitespace-nowrap shrink-0"
            >
              QUIZZI ARENA PRO
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('LANDING')}
              className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg"
              title="Về trang giới thiệu"
            >
              <Home className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Horizontal Scroll / Desktop Vertical List */}
          <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setGlobalError(null);
                    setActiveTab(item.id);
                  }}
                  className={`px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Profile Summary & Quick Role Switcher */}
        {currentUser && (
          <div className="hidden lg:block p-4 border-t border-slate-200 space-y-3">
            <div
              onClick={() => setActiveTab('PROFILE')}
              className="cursor-pointer group"
            >
              <div className="text-xs font-bold text-slate-950 group-hover:underline truncate">
                {currentUser.fullName}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {currentUser.role === 'ADMIN'
                  ? 'Quản trị viên hệ thống'
                  : currentUser.role === 'TEACHER'
                  ? 'Giáo viên'
                  : 'Học sinh'}{' '}
                · @{currentUser.username || 'user'}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('TEACHER')}
                className="flex-1 py-1.5 px-2 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
              >
                GV Mẫu
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('STUDENT')}
                className="flex-1 py-1.5 px-2 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
              >
                HS Mẫu
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 text-slate-500 hover:text-red-600 rounded transition-colors"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Workspace Header Contract: Breadcrumb on Left, Primary Actions on Right */}
        <header className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
            <span className="font-semibold text-slate-900 whitespace-nowrap">
              Đấu trường
            </span>
            <span aria-hidden="true">/</span>
            <span className="truncate">{activeNavLabel}</span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleCreateAndEnterRoom({ isTestMode: true })}
              className="px-3.5 py-2 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Tạo lượt chơi thử nghiệm</span>
            </button>

            {currentUser ? (
              <button
                type="button"
                onClick={handleLogout}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Đăng xuất
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthInitialTab('LOGIN');
                  setAuthModalOpen(true);
                }}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Đăng nhập
              </button>
            )}
          </div>
        </header>

        {/* Viewport Body */}
        <main className="flex-1 p-6 max-w-6xl w-full mx-auto space-y-6">
          {globalError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
              <span>{globalError}</span>
              <button
                type="button"
                onClick={() => setGlobalError(null)}
                className="font-semibold underline ml-4"
              >
                Đóng
              </button>
            </div>
          )}

          {/* VIEW 1: ROLE-SPECIFIC DASHBOARD (BẢNG ĐIỀU KHIỂN THEO VAI TRÒ - SECTION 7) */}
          {activeTab === 'DASHBOARD' && currentUser && (
            <div className="space-y-6">
              {/* Top Welcome & Quick Room PIN Entry */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
                    <span>Xin chào, {currentUser.fullName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-slate-800">
                      @{currentUser.username || 'user'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-amber-700">
                      {currentUser.role === 'ADMIN'
                        ? 'Dashboard Quản trị viên (ADMIN)'
                        : currentUser.role === 'TEACHER'
                        ? 'Dashboard Giáo viên (TEACHER)'
                        : 'Dashboard Học sinh (STUDENT)'}
                    </span>
                    {currentUser.schoolName && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{currentUser.schoolName}</span>
                      </>
                    )}
                  </div>
                  <h1 className="text-2xl font-bold text-slate-950">
                    {currentUser.role === 'ADMIN'
                      ? 'Bảng điều khiển Quản trị Hệ thống QUIZZI ARENA PRO'
                      : currentUser.role === 'TEACHER'
                      ? 'Bảng điều khiển Giảng dạy & Tổ chức Thi đấu'
                      : 'Bảng điều khiển Học tập & Thành tích Thi đấu Cá nhân'}
                  </h1>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (quickPinInput.trim()) handleQuickJoinPin(quickPinInput.trim());
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={quickPinInput}
                    onChange={(e) => setQuickPinInput(e.target.value)}
                    placeholder="Nhập mã PIN 6 số..."
                    className="px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg w-40"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <span>Vào phòng</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>

              {/* ================================================================== */}
              {/* A. DASHBOARD ADMIN                                                 */}
              {/* ================================================================== */}
              {currentUser.role === 'ADMIN' && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <div className="text-xs text-slate-500 mb-1">Tổng người dùng</div>
                      <div className="text-2xl font-bold text-slate-950 tabular-nums">
                        {roleDashboard?.adminMetrics?.totalUsers ?? diagnostics?.totalUsers ?? 0}
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('ADMIN_CONSOLE')}
                        className="text-[11px] font-semibold text-amber-700 hover:underline mt-2 inline-block"
                      >
                        Quản lý tài khoản →
                      </button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <div className="text-xs text-slate-500 mb-1">Số Giáo viên</div>
                      <div className="text-2xl font-bold text-slate-950 tabular-nums">
                        {roleDashboard?.adminMetrics?.teacherCount ?? 1}
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('ADMIN_CONSOLE')}
                        className="text-[11px] font-semibold text-amber-700 hover:underline mt-2 inline-block"
                      >
                        Danh sách GV →
                      </button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <div className="text-xs text-slate-500 mb-1">Số Học sinh</div>
                      <div className="text-2xl font-bold text-slate-950 tabular-nums">
                        {roleDashboard?.adminMetrics?.studentCount ?? 1}
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('TEACHER_AREA')}
                        className="text-[11px] font-semibold text-amber-700 hover:underline mt-2 inline-block"
                      >
                        Danh mục HS →
                      </button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <div className="text-xs text-slate-500 mb-1">Số Lớp học</div>
                      <div className="text-2xl font-bold text-slate-950 tabular-nums">
                        {roleDashboard?.adminMetrics?.classroomCount ?? classrooms.length}
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('TEACHER_AREA')}
                        className="text-[11px] font-semibold text-amber-700 hover:underline mt-2 inline-block"
                      >
                        Xem các lớp →
                      </button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <div className="text-xs text-slate-500 mb-1">Số Phòng thi đấu</div>
                      <div className="text-2xl font-bold text-slate-950 tabular-nums">
                        {roleDashboard?.adminMetrics?.totalRoomsCount ??
                          (diagnostics?.totalMatchesCompleted || 1) + activeRooms.length}
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('ARENA_ROOM')}
                        className="text-[11px] font-semibold text-amber-700 hover:underline mt-2 inline-block"
                      >
                        Phòng trực tiếp →
                      </button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <div className="text-xs text-slate-500 mb-1">Tổng lượt tham gia</div>
                      <div className="text-2xl font-bold text-emerald-700 tabular-nums">
                        {roleDashboard?.adminMetrics?.totalParticipations ?? 1}
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('HISTORY')}
                        className="text-[11px] font-semibold text-amber-700 hover:underline mt-2 inline-block"
                      >
                        Lịch sử đấu →
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                        <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-slate-700" />
                          <span>Hoạt động gần đây toàn hệ thống</span>
                        </h2>
                        <button
                          type="button"
                          onClick={() => setActiveTab('ADMIN_CONSOLE')}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-950"
                        >
                          Xem toàn bộ Nhật ký →
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {(roleDashboard?.adminMetrics?.recentActivities || []).map((act) => (
                          <div
                            key={act.id}
                            className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-start justify-between gap-3"
                          >
                            <div>
                              <div className="font-semibold text-slate-900">
                                {act.actorName} ({act.actorRole}) ·{' '}
                                <span className="font-mono text-amber-800">{act.action}</span>
                              </div>
                              <div className="text-slate-600 mt-0.5">{act.details}</div>
                            </div>
                            <span className="font-mono text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                              {new Date(act.createdAt).toLocaleTimeString('vi-VN')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                      <div className="pb-3 border-b border-slate-200 flex items-center justify-between">
                        <h2 className="text-base font-bold text-slate-950">
                          ối tắt Quản trị Hệ thống
                        </h2>
                      </div>
                      <div className="space-y-2.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setActiveTab('ADMIN_CONSOLE')}
                          className="w-full p-3.5 text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between"
                        >
                          <div>
                            <div className="font-bold text-slate-950">
                              Quản lý Đội ngũ Giáo viên &amp; Tài khoản
                            </div>
                            <div className="text-slate-500 mt-0.5">
                              Tạo, sửa, khóa/mở khóa tài khoản và xem thống kê giáo viên
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-600 shrink-0" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveTab('TEACHER_AREA')}
                          className="w-full p-3.5 text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between"
                        >
                          <div>
                            <div className="font-bold text-slate-950">
                              Quản lý Lớp học &amp; Nhập Học sinh từ CSV/Excel
                            </div>
                            <div className="text-slate-500 mt-0.5">
                              Kiểm tra các lớp học, chuyển lớp và nhập học sinh hàng loạt
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-600 shrink-0" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveTab('QUESTION_BANK')}
                          className="w-full p-3.5 text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between"
                        >
                          <div>
                            <div className="font-bold text-slate-950">
                              Ngân hàng Câu hỏi &amp; Bộ đề ({questionSets.length} bộ đề)
                            </div>
                            <div className="text-slate-500 mt-0.5">
                              Biên soạn câu hỏi trắc nghiệm và kiểm duyệt nội dung
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-600 shrink-0" />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ================================================================== */}
              {/* B. DASHBOARD GIÁO VIÊN                                             */}
              {/* ================================================================== */}
              {currentUser.role === 'TEACHER' && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <div className="text-xs text-slate-500 mb-1">Số lớp đang quản lý</div>
                      <div className="text-2xl font-bold text-slate-950 tabular-nums">
                        {roleDashboard?.teacherMetrics?.managedClassCount ?? classrooms.length}{' '}
                        lớp
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('TEACHER_AREA')}
                        className="text-[11px] font-semibold text-amber-700 hover:underline mt-2 inline-block"
                      >
                        Quản lý lớp →
                      </button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <div className="text-xs text-slate-500 mb-1">Tổng học sinh trong lớp</div>
                      <div className="text-2xl font-bold text-slate-950 tabular-nums">
                        {roleDashboard?.teacherMetrics?.totalStudentsInClasses ?? 0} HS
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('TEACHER_AREA')}
                        className="text-[11px] font-semibold text-amber-700 hover:underline mt-2 inline-block"
                      >
                        Danh sách HS →
                      </button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <div className="text-xs text-slate-500 mb-1">Số bộ câu hỏi</div>
                      <div className="text-2xl font-bold text-slate-950 tabular-nums">
                        {roleDashboard?.teacherMetrics?.questionSetCount ?? questionSets.length}{' '}
                        bộ
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('QUESTION_BANK')}
                        className="text-[11px] font-semibold text-amber-700 hover:underline mt-2 inline-block"
                      >
                        Ngân hàng đề →
                      </button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <div className="text-xs text-slate-500 mb-1">Số bài kiểm tra</div>
                      <div className="text-2xl font-bold text-slate-950 tabular-nums">
                        {roleDashboard?.teacherMetrics?.quizCount ?? questionSets.length} bài
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('QUESTION_BANK')}
                        className="text-[11px] font-semibold text-amber-700 hover:underline mt-2 inline-block"
                      >
                        Soạn đề thi →
                      </button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <div className="text-xs text-slate-500 mb-1">Số phòng thi đấu</div>
                      <div className="text-2xl font-bold text-emerald-700 tabular-nums">
                        {roleDashboard?.teacherMetrics?.hostedRoomCount ?? 1} phòng
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('TEACHER_AREA')}
                        className="text-[11px] font-semibold text-amber-700 hover:underline mt-2 inline-block"
                      >
                        Mở phòng PIN →
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                        <h2 className="text-base font-bold text-slate-950">
                          Kết quả thi đấu gần đây của các lớp
                        </h2>
                        <button
                          type="button"
                          onClick={() => setActiveTab('HISTORY')}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-950"
                        >
                          Xem toàn bộ lịch sử →
                        </button>
                      </div>

                      {(roleDashboard?.teacherMetrics?.recentClassResults || []).length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-500">
                          Chưa có kết quả thi đấu nào. Hãy mở phòng PIN cho lớp học để bắt đầu.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {(roleDashboard?.teacherMetrics?.recentClassResults || []).map((m) => (
                            <div
                              key={m.id}
                              className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                            >
                              <div>
                                <div className="font-bold text-slate-950">
                                  {m.roomTitle} (Mã PIN: {m.roomCode})
                                </div>
                                <div className="text-slate-500 mt-0.5">
                                  Bộ đề: {m.questionSetTitle} · {m.participantCount} học sinh tham gia
                                </div>
                              </div>
                              <span className="font-mono text-slate-500 tabular-nums">
                                {new Date(m.finishedAt).toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                      <div className="pb-3 border-b border-slate-200 flex items-center justify-between">
                        <h2 className="text-base font-bold text-slate-950">
                          Phát hành nhanh Phòng thi PIN
                        </h2>
                      </div>
                      <div className="space-y-2.5">
                        {questionSets.slice(0, 3).map((qs) => (
                          <div
                            key={qs.id}
                            className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="text-xs text-slate-500">
                                {qs.subject} · {qs.questionCount} câu
                              </div>
                              <div className="text-sm font-bold text-slate-950 truncate">
                                {qs.title}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleCreateAndEnterRoom({
                                  questionSetId: qs.id,
                                  isTestMode: false,
                                })
                              }
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shrink-0"
                            >
                              Mở phòng PIN
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ================================================================== */}
              {/* C. DASHBOARD HỌC SINH                                              */}
              {/* ================================================================== */}
              {currentUser.role === 'STUDENT' && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <div className="text-xs text-slate-500 mb-1">Các lớp đã tham gia</div>
                      <div className="text-2xl font-bold text-slate-950 tabular-nums">
                        {roleDashboard?.studentMetrics?.joinedClassCount ?? classrooms.length}{' '}
                        lớp
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('STUDENT_AREA')}
                        className="text-xs font-semibold text-amber-700 hover:underline mt-2 inline-block"
                      >
                        Nhập mã lớp mới →
                      </button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <div className="text-xs text-slate-500 mb-1">Phòng thi đang mở</div>
                      <div className="text-2xl font-bold text-slate-950 tabular-nums">
                        {roleDashboard?.studentMetrics?.activeRoomCount ?? activeRooms.length}{' '}
                        phòng
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('ARENA_ROOM')}
                        className="text-xs font-semibold text-amber-700 hover:underline mt-2 inline-block"
                      >
                        Vào phòng thi →
                      </button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <div className="text-xs text-slate-500 mb-1">Điểm số cá nhân tích lũy</div>
                      <div className="text-2xl font-bold text-amber-600 font-mono tabular-nums">
                        {roleDashboard?.studentMetrics?.personalTotalScore ?? 0} điểm
                      </div>
                      <div className="text-[11px] text-slate-500 mt-2">
                        Hạng hiện tại:{' '}
                        <strong className="font-mono text-slate-900">
                          {roleDashboard?.studentMetrics?.personalRank
                            ? `#${roleDashboard.studentMetrics.personalRank}`
                            : 'Chưa xếp hạng'}
                        </strong>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-5">
                      <div className="text-xs text-slate-500 mb-1">Thành tích đạt được</div>
                      <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums">
                        {roleDashboard?.studentMetrics?.accuracyPercent ?? 0}% chính xác
                      </div>
                      <div className="text-[11px] text-slate-500 mt-2">
                        Đã hoàn thành{' '}
                        <strong className="font-mono text-slate-900">
                          {roleDashboard?.studentMetrics?.matchesPlayed ?? 0}
                        </strong>{' '}
                        trận đấu
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Student Recent Match History & Active Rooms */}
                    <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                        <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
                          <Award className="w-4 h-4 text-amber-600" />
                          <span>Lịch sử tham gia thi đấu gần đây</span>
                        </h2>
                        <button
                          type="button"
                          onClick={() => setActiveTab('HISTORY')}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-950"
                        >
                          Xem chi tiết đáp án →
                        </button>
                      </div>

                      {(roleDashboard?.studentMetrics?.recentMatches || []).length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-500">
                          Bạn chưa có trận đấu nào hoàn tất. Hãy bấm "Tạo lượt chơi thử nghiệm" hoặc nhập mã PIN phòng thi để ghi điểm đầu tiên!
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {(roleDashboard?.studentMetrics?.recentMatches || []).map((m) => (
                            <div
                              key={m.id}
                              className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                            >
                              <div>
                                <div className="font-bold text-slate-950">
                                  {m.roomTitle} (PIN: {m.roomCode})
                                </div>
                                <div className="text-slate-500 mt-0.5">
                                  Bộ đề: {m.questionSetTitle} · Đúng{' '}
                                  <strong className="font-mono text-slate-800">
                                    {m.userCorrectCount ?? 0}/{m.totalQuestions}
                                  </strong>{' '}
                                  câu
                                </div>
                              </div>
                              <div className="text-right font-mono tabular-nums">
                                <div className="font-bold text-slate-950">
                                  {m.userScore ?? 0} điểm
                                </div>
                                <div className="text-[11px] text-amber-700">
                                  Hạng #{m.userRank || 1}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Public Leaderboard Preview for Student */}
                    <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                        <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-amber-500" />
                          <span>Bảng xếp hạng công khai</span>
                        </h2>
                        <button
                          type="button"
                          onClick={() => setActiveTab('LEADERBOARD')}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-950"
                        >
                          Toàn bảng →
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {(roleDashboard?.studentMetrics?.topLeaderboard || []).map(
                          (entry, idx) => (
                            <div
                              key={entry.userId}
                              className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="font-mono font-bold text-slate-500 w-5 tabular-nums">
                                  #{idx + 1}
                                </span>
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-950 truncate">
                                    {entry.fullName}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate">
                                    {entry.schoolName} · {entry.accuracyPercent}% chính xác
                                  </div>
                                </div>
                              </div>
                              <span className="font-mono font-bold text-slate-950 tabular-nums shrink-0">
                                {entry.totalScore} đ
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* VIEW 1.5: GAME CENTER & GAMIFICATION (PROMPT 5) */}
          {activeTab === 'GAME_CENTER' && currentUser && (
            <GameCenterView
              currentUser={currentUser}
              questionSets={questionSets}
              classrooms={classrooms}
              onRoomEntered={(room) => {
                setCurrentLiveRoom(room);
                setActiveTab('ARENA_ROOM');
              }}
              onRefreshGlobalData={refreshWorkspaceData}
            />
          )}

          {/* VIEW 2 & 3: TEACHER AREA & STUDENT AREA */}
          {(activeTab === 'TEACHER_AREA' || activeTab === 'STUDENT_AREA') && currentUser && (
            <TeacherStudentArea
              mode={activeTab}
              currentUser={currentUser}
              classrooms={classrooms}
              questionSets={questionSets}
              activeRooms={activeRooms}
              onRefreshData={refreshWorkspaceData}
              onCreateAndEnterRoom={handleCreateAndEnterRoom}
              onJoinRoomByPin={handleQuickJoinPin}
            />
          )}

          {/* VIEW 4: QUESTION BANK */}
          {activeTab === 'QUESTION_BANK' && currentUser && (
            <QuestionBankView
              currentUser={currentUser}
              questionSets={questionSets}
              onRefreshSets={refreshWorkspaceData}
              onLaunchRoomFromSet={(setId, isTestMode) =>
                handleCreateAndEnterRoom({ questionSetId: setId, isTestMode })
              }
            />
          )}

          {/* VIEW 5: LIVE ARENA ROOM */}
          {activeTab === 'ARENA_ROOM' && currentUser && (
            <>
              {currentLiveRoom ? (
                <LiveArenaRoom
                  initialRoom={currentLiveRoom}
                  currentUser={currentUser}
                  onExitRoom={() => {
                    setCurrentLiveRoom(null);
                    refreshWorkspaceData();
                    setActiveTab('DASHBOARD');
                  }}
                  onViewHistory={() => {
                    setCurrentLiveRoom(null);
                    refreshWorkspaceData();
                    setActiveTab('HISTORY');
                  }}
                />
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-xl mx-auto text-center space-y-5">
                  <Radio className="w-10 h-10 text-amber-600 mx-auto" />
                  <div>
                    <h2 className="text-xl font-bold text-slate-950 mb-1">
                      Chưa kết nối vào phòng thi đấu
                    </h2>
                    <p className="text-xs text-slate-500">
                      Nhập mã PIN 6 chữ số để vào phòng thi hiện có hoặc bấm tạo một lượt chơi thử nghiệm ngay lập tức.
                    </p>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (quickPinInput.trim()) handleQuickJoinPin(quickPinInput.trim());
                    }}
                    className="flex gap-2 max-w-sm mx-auto"
                  >
                    <input
                      type="text"
                      required
                      value={quickPinInput}
                      onChange={(e) => setQuickPinInput(e.target.value)}
                      placeholder="Nhập mã PIN 6 số..."
                      className="flex-1 px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
                    >
                      Vào phòng
                    </button>
                  </form>

                  <div className="pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleCreateAndEnterRoom({ isTestMode: true })}
                      className="px-5 py-2.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg inline-flex items-center gap-2"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Khởi tạo lượt chơi thử nghiệm ngay</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* VIEW 6 & 7: LEADERBOARD & MATCH HISTORY */}
          {(activeTab === 'LEADERBOARD' || activeTab === 'HISTORY') && currentUser && (
            <LeaderboardHistoryView
              mode={activeTab}
              currentUser={currentUser}
              classrooms={classrooms}
            />
          )}

          {/* VIEW 8 & 9: ADMIN CONSOLE & PERSONAL PROFILE */}
          {(activeTab === 'ADMIN_CONSOLE' || activeTab === 'PROFILE') && currentUser && (
            <AdminProfileView
              mode={activeTab}
              currentUser={currentUser}
              classrooms={classrooms}
              diagnostics={diagnostics}
              onUserUpdated={(updated) => setCurrentUser(updated)}
              onOpenClaimAdmin={() => {
                setAuthInitialTab('CLAIM_ADMIN');
                setAuthModalOpen(true);
              }}
            />
          )}
        </main>
      </div>

      {authModalOpen && (
        <AuthModal
          initialTab={authInitialTab}
          adminInitialized={adminInitialized}
          passcodeConfigured={passcodeConfigured}
          onClose={() => setAuthModalOpen(false)}
          onSuccess={handleAuthSuccess}
        />
      )}
    </div>
  );
}
