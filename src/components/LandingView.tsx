import React, { useState } from 'react';
import { ArrowRight, Play, ShieldCheck, Trophy, Users, Layers } from 'lucide-react';
import type { SystemArchitectureDiagnostics, UserProfile } from '../types/arena.ts';

interface LandingViewProps {
  currentUser: UserProfile | null;
  diagnostics: SystemArchitectureDiagnostics | null;
  onOpenAuth: (initialTab: 'LOGIN' | 'REGISTER' | 'CLAIM_ADMIN') => void;
  onEnterWorkspace: () => void;
  onQuickJoinPin: (pin: string) => void;
  onQuickStartDemoMatch: () => void;
  onQuickDemoLogin: (role: 'TEACHER' | 'STUDENT') => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  currentUser,
  diagnostics,
  onOpenAuth,
  onEnterWorkspace,
  onQuickJoinPin,
  onQuickStartDemoMatch,
  onQuickDemoLogin,
}) => {
  const [pinCode, setPinCode] = useState('');
  const [imgError, setImgError] = useState(false);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinCode.trim()) return;
    onQuickJoinPin(pinCode.trim());
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 lg:px-12 py-4 bg-white border-b border-slate-200 sticky top-0 z-30">
        <a
          href="#top"
          className="text-lg font-bold tracking-tight text-slate-950 font-display whitespace-nowrap shrink-0"
        >
          QUIZZI ARENA PRO
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a
            href="#arena-features"
            className="hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Tính năng đấu trường
          </a>
          <a
            href="#roles-matrix"
            className="hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Phân quyền
          </a>
          <a
            href="#security-engine"
            className="hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Bảo mật chấm điểm
          </a>
          <a
            href="#architecture"
            className="hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Kiến trúc hệ thống
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          {currentUser ? (
            <button
              onClick={onEnterWorkspace}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              Vào bảng điều khiển
            </button>
          ) : (
            <button
              onClick={() => onOpenAuth('LOGIN')}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              Đăng nhập / Đăng ký
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main id="top" className="flex-1">
        {/* Hero Split Section */}
        <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-10 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left Column: Arena Narrative & Interactive Room Entry */}
            <div className="lg:col-span-7 flex flex-col justify-between bg-white border border-slate-200 rounded-xl p-8">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-4">
                  <span>Đấu trường tri thức trực tuyến</span>
                  <span aria-hidden="true">·</span>
                  <span>Thời gian thực WebSocket</span>
                  <span aria-hidden="true">·</span>
                  <span>Chấm điểm phía máy chủ</span>
                </div>

                <h1
                  className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-950 tracking-tight leading-tight mb-5"
                  style={{ textWrap: 'balance' }}
                >
                  Tổ chức thi đấu &amp; kiểm tra kiến thức trực tuyến chuẩn xác cho lớp học hiện đại.
                </h1>

                <p className="text-base text-slate-600 leading-relaxed max-w-2xl mb-8">
                  QUIZZI ARENA PRO kết hợp ngân hàng câu hỏi học thuật, quản lý lớp học theo mã định danh và phòng thi đấu thời gian thực chống gian lận — không lộ đáp án xuống trình duyệt học sinh trước khi hết giờ.
                </p>

                {/* Live PIN Entry Form + 1-Click Test Match */}
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg mb-6">
                  <div className="text-xs font-semibold text-slate-700 mb-3">
                    Tham gia phòng thi đấu bằng mã PIN hoặc khởi tạo lượt chơi thử nghiệm
                  </div>
                  <form onSubmit={handlePinSubmit} className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value)}
                      placeholder="Nhập mã phòng 6 số (VD: 842910)..."
                      maxLength={8}
                      className="flex-1 px-4 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="submit"
                      className="px-5 py-2.5 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                    >
                      <span>Vào phòng ngay</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={onQuickStartDemoMatch}
                      className="px-5 py-2.5 text-sm font-semibold text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                    >
                      <Play className="w-4 h-4 text-amber-600" />
                      <span>Chơi thử nghiệm</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* Quick Role Experience Bar */}
              <div className="pt-5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div className="text-xs text-slate-500">
                  Trải nghiệm nhanh theo phân quyền thực tế hoặc tạo tài khoản mới:
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onQuickDemoLogin('TEACHER')}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Phiên Giáo viên mẫu
                  </button>
                  <button
                    type="button"
                    onClick={() => onQuickDemoLogin('STUDENT')}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Phiên Học sinh mẫu
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenAuth('CLAIM_ADMIN')}
                    className="px-3.5 py-2 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Khởi tạo Quản trị viên
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: High-Fidelity Arena Visual with Zero-Broken-Image Fallback */}
            <div className="lg:col-span-5 relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 min-h-[340px] flex flex-col justify-end">
              {!imgError ? (
                <img
                  src="/src/assets/images/quizzi_arena_hero_1795710266478.jpg"
                  alt="Không gian đấu trường tri thức trực tuyến QUIZZI ARENA PRO"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 flex items-center justify-center p-8">
                  <Trophy className="w-16 h-16 text-amber-400 opacity-40" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />

              <div className="relative z-10 p-6 text-white">
                <div className="flex items-center gap-2 text-xs text-amber-300 font-medium mb-2">
                  <span>Đấu trường học thuật trực tiếp</span>
                  <span aria-hidden="true">·</span>
                  <span>Chấm điểm tốc độ &amp; chuỗi đúng</span>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">
                  Sân khấu thi đấu minh bạch cho mọi lớp học
                </h2>
                <p className="text-xs text-slate-200 leading-relaxed">
                  Giáo viên chủ động điều phối nhịp độ từng câu hỏi, công bố phânổ đáp án trực quan và lưu trữ toàn bộ lịch sử làm bài của học sinh.
                </p>
              </div>
            </div>
          </div>

          {/* Full-Width 4-Column Quantitative Proof Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500 mb-1">Bộ câu hỏi học thuật sẵn có</div>
              <div className="text-2xl font-bold text-slate-950 tabular-nums">
                {diagnostics ? diagnostics.totalQuestionSets : 3} bộ đề
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {diagnostics ? diagnostics.totalQuestions : 11} câu hỏi trắc nghiệm có lời giải
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500 mb-1">Bảo mật đáp án phía máy chủ</div>
              <div className="text-2xl font-bold text-emerald-700 tabular-nums">100% Server</div>
              <div className="text-xs text-slate-500 mt-1">
                Ẩn hoàn toàn trường đáp án đúng khi đang đếm ngược
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500 mb-1">Phòng đang hoạt động</div>
              <div className="text-2xl font-bold text-slate-950 tabular-nums">
                {diagnostics ? diagnostics.activeLiveRooms : 0} phòng
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {diagnostics ? diagnostics.totalMatchesCompleted : 1} trận đấu đã hoàn tất lưu trữ
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500 mb-1">Tài khoản trên hệ thống</div>
              <div className="text-2xl font-bold text-slate-950 tabular-nums">
                {diagnostics ? diagnostics.totalUsers : 3} thành viên
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Quản trị viên · Giáo viên · Học sinh
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: 3 Role Groups & Functional Matrix */}
        <section id="roles-matrix" className="max-w-7xl mx-auto px-6 lg:px-12 py-10 border-t border-slate-200">
          <div className="mb-8">
            <div className="text-xs font-medium text-slate-500 mb-2">
              01. Hệ thống phân quyền 3 tầng
            </div>
            <h2 className="text-2xl font-bold text-slate-950">
              Không gian làm việc chuyên biệt cho từng vai trò
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-slate-500">Nhóm quyền 01</span>
                  <Users className="w-5 h-5 text-slate-700" />
                </div>
                <h3 className="text-lg font-bold text-slate-950 mb-2">Khu vực Giáo viên</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  Khởi tạo lớp học với mã định danh riêng, biên soạn ngân hàng câu hỏi trắc nghiệm 4 lựa chọn, mở phòng thi đấu sinh mã PIN 6 số và điều phối trận đấu trực tiếp.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 text-xs text-slate-500">
                Tạo lớp học · Tạo bộ đề · Điều khiển phòng thi
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-slate-500">Nhóm quyền 02</span>
                  <Trophy className="w-5 h-5 text-amber-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-950 mb-2">Khu vực Học sinh</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  Gia nhập lớp học bằng mã lớp, vào sảnh chờ thi đấu bằng mã PIN 6 số, tự tạo lượt chơi thử nghiệm để ôn tập, và theo dõi lịch sử đáp án chi tiết sau mỗi trận.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 text-xs text-slate-500">
                Vào phòng bằng PIN · Lượt chơi thử · Xem lời giải
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-slate-500">Nhóm quyền 03</span>
                  <ShieldCheck className="w-5 h-5 text-emerald-700" />
                </div>
                <h3 className="text-lg font-bold text-slate-950 mb-2">Quản trị viên Hệ thống</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  Quản lý danh sách tài khoản toàn hệ thống, phân quyền Giáo viên / Học sinh / Quản trị viên, khóa tài khoản vi phạm và giám sát thông số kiến trúc máy chủ.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 text-xs text-slate-500">
                Phân quyền RBAC · Kiểm soát tài khoản · Giám sát DB
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Security & Extensible Architecture */}
        <section id="architecture" className="max-w-7xl mx-auto px-6 lg:px-12 py-10 border-t border-slate-200">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div id="security-engine" className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-2">
                <span>02. Nguyên tắc bảo mật thực thi</span>
              </div>
              <h3 className="text-xl font-bold text-slate-950 mb-4">
                Chống gian lận phía máy chủ (Server-Authoritative)
              </h3>
              <ul className="space-y-3 text-sm text-slate-600">
                <li>
                  <strong className="text-slate-900">Không lộ đáp án đúng trước khi hết câu hỏi:</strong> Khi câu hỏi đang ở trạng thái đếm ngược, máy chủ lọc bỏ hoàn toàn trường <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">correctIndex</code> và <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">explanation</code> trước khi phát qua WebSocket và API.
                </li>
                <li>
                  <strong className="text-slate-900">Chấm điểm độc quyền tại máy chủ:</strong> Học sinh chỉ gửi chỉ số lựa chọn (0–3). Máy chủ tự đối chiếu thời gian phản hồi thực tế, tính điểm tốc độ và cộng chuỗi trả lời đúng.
                </li>
                <li>
                  <strong className="text-slate-900">Xác thực &amp; Kiểm tra quyền RBAC:</strong> Mật khẩu băm bằng thuật toán <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">scrypt</code> kèm salt ngẫu nhiên; mọi truy vấn SQL đều tham số hóa (Prepared Statements).
                </li>
              </ul>
            </div>

            <div id="arena-features" className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500">
                  03. Kiến trúc mở rộng &amp; Giới hạn tải thực tế
                </span>
                <Layers className="w-4 h-4 text-slate-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-950 mb-4">
                Thiết kế tách lớp Repository &amp; Real-time Engine
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                {diagnostics?.concurrencyLimitsNote ||
                  'Hệ thống tách biệt giao diện IDataRepository và bộ điều phối WebSocket ArenaRealtimeManager. Phiên bản hiện tại chạy trực tiếp với SQLite WAL + Node.js WebSocket miễn phí, sẵn sàng thay thế bằng PostgreSQL và Redis Pub/Sub khi mở rộng lên quy mô hàng trăm người chơi đồng thời.'}
              </p>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block">Tầng lưu trữ hiện tại</span>
                  <span className="font-mono text-slate-800 font-medium">
                    {diagnostics?.databaseEngine || 'SQLite 3 (WAL Mode)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Tầng giao tiếp thời gian thực</span>
                  <span className="font-mono text-slate-800 font-medium">
                    WebSocket (/ws) + REST Fallback
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="px-6 lg:px-12 py-6 bg-white border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>QUIZZI ARENA PRO — Nền tảng tổ chức thi đấu và kiểm tra kiến thức trực tuyến.</div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onOpenAuth('LOGIN')}
            className="hover:text-slate-900 transition-colors"
          >
            Đăng nhập
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => onOpenAuth('REGISTER')}
            className="hover:text-slate-900 transition-colors"
          >
            Đăng ký tài khoản
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => onOpenAuth('CLAIM_ADMIN')}
            className="hover:text-slate-900 transition-colors"
          >
            Cấu hình Quản trị viên
          </button>
        </div>
      </footer>
    </div>
  );
};
