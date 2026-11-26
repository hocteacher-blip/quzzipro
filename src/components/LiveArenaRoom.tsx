import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Copy,
  Play,
  Pause,
  SkipForward,
  Trophy,
  Users,
  XCircle,
  ArrowLeft,
  Eye,
  Lock,
  Unlock,
  Link2,
  Square,
  Wifi,
  WifiOff,
  CheckSquare,
} from 'lucide-react';
import { api, createRoomWebSocket } from '../services/apiClient.ts';
import type { LiveRoomState, UserProfile } from '../types/arena.ts';

interface LiveArenaRoomProps {
  initialRoom: LiveRoomState;
  currentUser: UserProfile;
  onExitRoom: () => void;
  onViewHistory: () => void;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

export const LiveArenaRoom: React.FC<LiveArenaRoomProps> = ({
  initialRoom,
  currentUser,
  onExitRoom,
  onViewHistory,
}) => {
  const [room, setRoom] = useState<LiveRoomState>(initialRoom);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedMultiIndices, setSelectedMultiIndices] = useState<number[]>([]);
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmEndMatch, setConfirmEndMatch] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canControlRoom =
    room.hostId === currentUser.id ||
    currentUser.role === 'ADMIN' ||
    room.isTestMode;

  const myParticipant = room.participants.find((p) => p.userId === currentUser.id) || null;
  const currentQuestionType = room.currentQuestion?.questionType || 'SINGLE_CHOICE';

  // Connect WebSocket for real-time updates + fallback sync
  useEffect(() => {
    const ws = createRoomWebSocket(
      initialRoom.code,
      (updatedRoom) => {
        setRoom(updatedRoom);
      },
      (err) => setErrorMsg(err)
    );

    const pollInterval = setInterval(async () => {
      try {
        const res = await api.getRoomState(initialRoom.code);
        setRoom(res.room);
      } catch {
        // ignore transient poll error
      }
    }, 3000);

    return () => {
      clearInterval(pollInterval);
      if (ws) ws.close();
    };
  }, [initialRoom.code]);

  // Reset local selection when question index changes or enters active phase
  useEffect(() => {
    if (room.status === 'QUESTION_ACTIVE' || room.status === 'PAUSED') {
      if (myParticipant && myParticipant.hasAnsweredCurrent) {
        setSelectedIndex(myParticipant.lastSelectedIndex);
        setSelectedMultiIndices(myParticipant.lastSelectedIndices || []);
      } else {
        setSelectedIndex(null);
        setSelectedMultiIndices([]);
      }
    }
  }, [room.currentQuestionIndex, room.status]);

  // Accurate countdown timer synced with server questionEndsAt / pausedRemainingMs
  useEffect(() => {
    if (room.status === 'PAUSED') {
      const pausedSec = Math.max(
        0,
        Math.ceil(((room.pausedRemainingMs || 0) as number) / 1000)
      );
      setRemainingSec(pausedSec);
      return;
    }

    if (room.status !== 'QUESTION_ACTIVE' || !room.questionEndsAt) {
      setRemainingSec(0);
      return;
    }

    const offsetMs = Date.now() - (room.serverTimeMs || Date.now());
    const updateTimer = () => {
      const serverNow = Date.now() - offsetMs;
      const diffSec = Math.max(0, Math.ceil((room.questionEndsAt! - serverNow) / 1000));
      setRemainingSec(diffSec);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 200);
    return () => clearInterval(timer);
  }, [room.status, room.questionEndsAt, room.pausedRemainingMs, room.serverTimeMs]);

  const shareUrl = `${window.location.origin}/?room=${room.code}`;

  const handleCopyPin = () => {
    navigator.clipboard?.writeText(room.code);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const handleCopyShareLink = () => {
    navigator.clipboard?.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleAdvanceRoom = async () => {
    setErrorMsg(null);
    setActionLoading(true);
    try {
      const res = await api.advanceRoom(room.code);
      setRoom(res.room);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể chuyển trạng thái phòng.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleForceReveal = async () => {
    setErrorMsg(null);
    setActionLoading(true);
    try {
      const res = await api.revealRoomQuestion(room.code);
      setRoom(res.room);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể công bố đáp án.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTogglePauseResume = async () => {
    setErrorMsg(null);
    setActionLoading(true);
    try {
      const res =
        room.status === 'PAUSED'
          ? await api.resumeRoom(room.code)
          : await api.pauseRoom(room.code);
      setRoom(res.room);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể tạm dừng/tiếp tục trận đấu.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleJoinLock = async () => {
    setErrorMsg(null);
    setActionLoading(true);
    try {
      const res = await api.toggleRoomLock(room.code, !room.isJoinLocked);
      setRoom(res.room);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể khóa/mở khóa phòng.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndMatchEarly = async () => {
    setErrorMsg(null);
    setActionLoading(true);
    try {
      const res = await api.endRoom(room.code);
      setRoom(res.room);
      setConfirmEndMatch(false);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể kết thúc trận đấu.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectSingleAnswer = async (idx: number) => {
    if (room.status !== 'QUESTION_ACTIVE') return;
    if (selectedIndex !== null || myParticipant?.hasAnsweredCurrent) return;

    setSelectedIndex(idx);
    setErrorMsg(null);
    try {
      const res = await api.submitRoomAnswer(room.code, {
        selectedIndex: idx,
        questionId: room.currentQuestion?.id,
        sessionId: room.sessionId,
      });
      setRoom(res.room);
    } catch (err: any) {
      setSelectedIndex(null);
      setErrorMsg(err?.message || 'Không thể gửi câu trả lời.');
    }
  };

  const handleToggleMultiOption = (idx: number) => {
    if (room.status !== 'QUESTION_ACTIVE' || myParticipant?.hasAnsweredCurrent) return;
    setSelectedMultiIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const handleSubmitMultiAnswer = async () => {
    if (room.status !== 'QUESTION_ACTIVE' || myParticipant?.hasAnsweredCurrent) return;
    if (selectedMultiIndices.length === 0) {
      setErrorMsg('Vui lòng chọn ít nhất một phương án trước khi gửi.');
      return;
    }
    setErrorMsg(null);
    try {
      const res = await api.submitRoomAnswer(room.code, {
        selectedIndices: selectedMultiIndices,
        questionId: room.currentQuestion?.id,
        sessionId: room.sessionId,
      });
      setRoom(res.room);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể gửi câu trả lời.');
    }
  };

  const onlineCount = room.participants.filter((p) => p.isOnline).length;
  const answeredCount = room.participants.filter((p) => p.hasAnsweredCurrent).length;
  const answerProgressPercent =
    room.participants.length > 0
      ? Math.round((answeredCount / room.participants.length) * 100)
      : 0;

  const totalTimeSec = room.currentQuestion?.timeLimitSec || 20;
  const progressPercent =
    room.status === 'QUESTION_ACTIVE' || room.status === 'PAUSED'
      ? Math.min(100, Math.max(0, (remainingSec / totalTimeSec) * 100))
      : 0;

  const gameModeLabel =
    room.gameMode === 'STANDARD'
      ? 'Tiêu chuẩn (Điểm cố định)'
      : room.gameMode === 'HIGH_STAKES'
      ? 'Thử thách (Thưởng lớn · Trừ điểm sai)'
      : 'Tốc độ & Chính xác';

  return (
    <div className="space-y-6">
      {/* Arena Header Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
            <span>Mã phòng PIN:</span>
            <span className="font-mono font-bold text-slate-950">{room.code}</span>
            <span aria-hidden="true">·</span>
            <span>Giáo viên: {room.hostName}</span>
            <span aria-hidden="true">·</span>
            <span>Chế độ: {gameModeLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              Kết nối: {onlineCount}/{room.participants.length} (Tối đa{' '}
              {room.maxParticipants || 100})
            </span>
            {room.isJoinLocked && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-red-700 font-semibold">Đã đóng nhận người mới</span>
              </>
            )}
            {room.isTestMode && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-amber-700 font-semibold">Chế độ chơi thử nghiệm</span>
              </>
            )}
          </div>
          <h2 className="text-xl font-bold text-slate-950">{room.title}</h2>
          {room.description && (
            <p className="text-xs text-slate-500 mt-0.5">{room.description}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyPin}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copiedPin ? 'Đã chép PIN' : `Mã PIN: ${room.code}`}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyShareLink}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>{copiedLink ? 'Đã chép đường dẫn' : 'Sao chép Link tham gia'}</span>
          </button>

          {canControlRoom && room.status !== 'FINISHED' && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleToggleJoinLock}
              className={`px-3 py-2 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                room.isJoinLocked
                  ? 'bg-red-50 text-red-700 hover:bg-red-100'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {room.isJoinLocked ? (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Mở nhận người chơi</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Khóa phòng</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onExitRoom}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Rời phòng</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="underline font-semibold ml-3"
          >
            Đóng
          </button>
        </div>
      )}

      {/* PHASE 1: LOBBY */}
      {room.status === 'LOBBY' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-slate-900 text-white rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="text-xs text-amber-400 font-medium mb-2">
                  {room.isTeamMode
                    ? 'Sảnh chờ Thi đấu theo Đội (Team Arena)'
                    : 'Sảnh chờ Đấu trường trực tiếp'}
                </div>
                <div className="text-xs text-slate-300 mb-1">
                  Học sinh nhập mã PIN 6 chữ số hoặc truy cập đường dẫn chia sẻ:
                </div>
                <div className="text-4xl sm:text-5xl font-mono font-bold tracking-wider text-white my-4 tabular-nums">
                  {room.code}
                </div>
                <div className="p-3 bg-slate-800/90 border border-slate-700 rounded-lg text-[11px] font-mono text-slate-300 break-all mb-4">
                  {shareUrl}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mb-6">
                  Bộ đề: <strong className="text-white">{room.questionSetTitle}</strong> (
                  {room.totalQuestions} câu hỏi). Chế độ tính điểm:{' '}
                  <strong className="text-amber-300">{gameModeLabel}</strong>. Chính sách đáp án:{' '}
                  <strong className="text-emerald-300">
                    {room.revealAnswersPolicy === 'END_OF_MATCH'
                      ? 'Công bố cuối trận'
                      : 'Công bố sau mỗi câu'}
                  </strong>
                  .
                </p>
              </div>

              {canControlRoom ? (
                <div className="space-y-2.5">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleAdvanceRoom}
                    className="w-full py-3 px-5 text-sm font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Bắt đầu trận đấu ngay ({room.totalQuestions} câu hỏi)</span>
                  </button>
                </div>
              ) : (
                <div className="p-3.5 bg-slate-800 rounded-lg text-xs text-slate-300">
                  Đang chờ Giáo viên chủ phòng ({room.hostName}) bấm bắt đầu trận đấu...
                </div>
              )}
            </div>

            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              {/* Team Mode Toggle & Configuration Bar for Teacher */}
              {canControlRoom && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-bold text-slate-900">
                      Cấu hình Thi đấu theo Đội (Team Arena)
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await api.configureRoomTeams(room.code, {
                              action: 'CREATE_TEAM',
                            });
                            setRoom(res.room);
                          } catch (err: any) {
                            setErrorMsg(err?.message || 'Không thể thêm đội.');
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold"
                      >
                        + Thêm đội mới
                      </button>
                      {room.isTeamMode && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const res = await api.configureRoomTeams(room.code, {
                                action: 'AUTO_ASSIGN',
                              });
                              setRoom(res.room);
                            } catch (err: any) {
                              setErrorMsg(err?.message || 'Không thể chia đội tự động.');
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 text-xs font-semibold"
                        >
                          Chia đội tự động cân bằng
                        </button>
                      )}
                    </div>
                  </div>

                  {room.isTeamMode && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                          Hình thức phối hợp đồng đội
                        </label>
                        <select
                          value={room.teamPlayFormat || 'ALL_MEMBERS_SCORE'}
                          onChange={async (e) => {
                            try {
                              const res = await api.configureRoomTeams(room.code, {
                                action: 'SET_FORMAT',
                                teamPlayFormat: e.target.value as any,
                              });
                              setRoom(res.room);
                            } catch (err: any) {
                              setErrorMsg(err?.message);
                            }
                          }}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 font-semibold"
                        >
                          <option value="ALL_MEMBERS_SCORE">
                            1. Mọi thành viên trả lời (Chuẩn hóa trung bình đội)
                          </option>
                          <option value="CAPTAIN_REPRESENTATIVE">
                            2. Đội trưởng đại diện chốt đáp án
                          </option>
                          <option value="TURN_BY_TURN">
                            3. Luân phiên theo lượt từng thành viên
                          </option>
                          <option value="TEAM_CONSENSUS">
                            4. Đồng thuận đội (Đa số chọn đúng)
                          </option>
                        </select>
                      </div>
                      <div className="text-[11px] text-slate-600 flex items-center">
                        Giáo viên có thể chuyển học sinh giữa các đội hoặc chỉ định Đội trưởng trực tiếp ở danh sách bên dưới trước khi bắt đầu.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Teams Overview Cards in Lobby */}
              {room.isTeamMode && room.teams && room.teams.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {room.teams.map((t) => (
                    <div
                      key={t.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: t.colorHex }}
                          />
                          <span className="text-xs font-bold text-slate-950">{t.name}</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                          {t.memberCount} thành viên
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-700" />
                  <h3 className="text-base font-bold text-slate-950">
                    Danh sách người tham gia trong phòng
                  </h3>
                </div>
                <span className="text-xs font-mono font-semibold text-slate-600 tabular-nums">
                  {room.participants.length} / {room.maxParticipants || 100} người
                </span>
              </div>

              {room.participants.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  Chưa có người tham gia nào trong sảnh chờ.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {room.participants.map((p) => (
                    <div
                      key={p.userId}
                      className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-slate-900 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                            {p.displayName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">
                              {p.displayName}
                              {p.userId === currentUser.id ? ' (Bạn)' : ''}
                            </div>
                            <div className="text-xs text-slate-500">
                              {p.teamName ? (
                                <span className="font-semibold text-slate-800">
                                  {p.teamName}
                                  {p.isTeamCaptain ? ' (Đội trưởng)' : ''}
                                </span>
                              ) : p.role === 'TEACHER' ? (
                                'Giáo viên'
                              ) : p.role === 'ADMIN' ? (
                                'Quản trị viên'
                              ) : (
                                'Học sinh'
                              )}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`text-xs font-mono font-medium inline-flex items-center gap-1 shrink-0 ${
                            p.isOnline ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          {p.isOnline ? (
                            <>
                              <Wifi className="w-3.5 h-3.5" />
                              <span>Sẵn sàng</span>
                            </>
                          ) : (
                            <>
                              <WifiOff className="w-3.5 h-3.5" />
                              <span>Mất kết nối</span>
                            </>
                          )}
                        </span>
                      </div>

                      {canControlRoom &&
                        room.isTeamMode &&
                        room.teams &&
                        room.teams.length > 0 && (
                          <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80">
                            <select
                              value={p.teamId || ''}
                              onChange={async (e) => {
                                if (!e.target.value) return;
                                try {
                                  const res = await api.configureRoomTeams(room.code, {
                                    action: 'ASSIGN_MEMBER',
                                    targetUserId: p.userId,
                                    teamId: e.target.value,
                                  });
                                  setRoom(res.room);
                                } catch (err: any) {
                                  setErrorMsg(err?.message);
                                }
                              }}
                              className="flex-1 text-[11px] border border-slate-300 rounded px-2 py-1 bg-white text-slate-800"
                            >
                              <option value="">-- Chọn đội --</option>
                              {room.teams.map((t) => (
                                <option key={t.id} value={t.id}>
                                  Chuyển sang: {t.name}
                                </option>
                              ))}
                            </select>
                            {p.teamId && !p.isTeamCaptain && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const res = await api.configureRoomTeams(room.code, {
                                      action: 'SET_CAPTAIN',
                                      targetUserId: p.userId,
                                      teamId: p.teamId!,
                                    });
                                    setRoom(res.room);
                                  } catch (err: any) {
                                    setErrorMsg(err?.message);
                                  }
                                }}
                                className="px-2 py-1 text-[10px] font-semibold bg-amber-100 text-amber-900 rounded"
                              >
                                Đặt Đội trưởng
                              </button>
                            )}
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PHASE 2 & 3: QUESTION ACTIVE, PAUSED, OR QUESTION REVEAL */}
      {(room.status === 'QUESTION_ACTIVE' ||
        room.status === 'PAUSED' ||
        room.status === 'QUESTION_REVEAL') &&
        room.currentQuestion && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Main Question & Options Stage */}
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
              <div>
                {/* Question Status Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 mb-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                    <span>
                      Câu hỏi {room.currentQuestionIndex + 1} / {room.totalQuestions}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {currentQuestionType === 'MULTIPLE_CHOICE'
                        ? 'Nhiều đáp án đúng'
                        : currentQuestionType === 'TRUE_FALSE'
                        ? 'Đúng hoặc Sai'
                        : 'Một đáp án đúng'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{room.currentQuestion.points} điểm chuẩn</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      Đã trả lời: {answeredCount}/{room.participants.length} ({answerProgressPercent}
                      %)
                    </span>
                  </div>

                  {room.status === 'QUESTION_ACTIVE' ? (
                    <div
                      className={`flex items-center gap-2 text-sm font-mono font-bold tabular-nums ${
                        remainingSec <= 5 ? 'text-red-600' : 'text-amber-700'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      <span>Còn {remainingSec} giây</span>
                    </div>
                  ) : room.status === 'PAUSED' ? (
                    <div className="text-xs font-bold text-amber-700">
                      TẠM DỪNG — Bảo lưu {remainingSec} giây còn lại
                    </div>
                  ) : (
                    <div className="text-xs font-semibold text-emerald-700">
                      Đã khóa câu hỏi — Máy chủ đã công bố đáp án đúng
                    </div>
                  )}
                </div>

                {/* Countdown & Submission Progress Bars */}
                {(room.status === 'QUESTION_ACTIVE' || room.status === 'PAUSED') && (
                  <div className="space-y-2 mb-6">
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-200 ${
                          room.status === 'PAUSED'
                            ? 'bg-slate-400'
                            : remainingSec <= 5
                            ? 'bg-red-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {room.status === 'PAUSED' && (
                  <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-semibold">
                    Trận đấu đang được Giáo viên tạm dừng. Đồng hồ đếm ngược đã được khóa trên máy chủ ({remainingSec} giây còn lại).
                  </div>
                )}

                {/* Question Prompt */}
                <h3 className="text-xl sm:text-2xl font-bold text-slate-950 leading-snug mb-5">
                  {room.currentQuestion.prompt}
                </h3>

                {/* Optional Multimedia (Image / Audio / Video) */}
                {(room.currentQuestion.imageUrl ||
                  room.currentQuestion.audioUrl ||
                  room.currentQuestion.videoUrl) && (
                  <div className="mb-5 space-y-3">
                    {room.currentQuestion.imageUrl && (
                      <img
                        src={room.currentQuestion.imageUrl}
                        alt="Hình minh họa câu hỏi"
                        className="max-h-60 rounded-xl border border-slate-200 object-contain mx-auto"
                      />
                    )}
                    {room.currentQuestion.audioUrl && (
                      <audio
                        controls
                        src={room.currentQuestion.audioUrl}
                        className="w-full"
                      />
                    )}
                    {room.currentQuestion.videoUrl && (
                      <video
                        controls
                        src={room.currentQuestion.videoUrl}
                        className="max-h-64 rounded-xl border border-slate-200 mx-auto"
                      />
                    )}
                  </div>
                )}

                {/* Options Grid (Supports SINGLE_CHOICE, TRUE_FALSE, MULTIPLE_CHOICE) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
                  {room.currentQuestion.options.map((optText, idx) => {
                    const isMulti = currentQuestionType === 'MULTIPLE_CHOICE';
                    const isMyChoice = isMulti
                      ? selectedMultiIndices.includes(idx) ||
                        Boolean(myParticipant?.lastSelectedIndices?.includes(idx))
                      : selectedIndex === idx || myParticipant?.lastSelectedIndex === idx;

                    const isRevealed = room.status === 'QUESTION_REVEAL';
                    const isCorrectOption =
                      isRevealed &&
                      (Array.isArray(room.revealedCorrectIndices)
                        ? room.revealedCorrectIndices.includes(idx)
                        : room.revealedCorrectIndex === idx);
                    const isWrongChoice = isRevealed && isMyChoice && !isCorrectOption;

                    const voteCount = room.answerDistribution?.counts[idx] ?? 0;

                    let cardStyle =
                      'bg-white border-slate-300 hover:border-slate-900 hover:bg-slate-50 text-slate-900';

                    if (room.status === 'QUESTION_ACTIVE' || room.status === 'PAUSED') {
                      if (isMyChoice) {
                        cardStyle = 'bg-slate-900 border-slate-900 text-white';
                      } else if (
                        (!isMulti && selectedIndex !== null) ||
                        myParticipant?.hasAnsweredCurrent ||
                        room.status === 'PAUSED'
                      ) {
                        cardStyle =
                          'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed';
                      }
                    } else if (isRevealed) {
                      if (isCorrectOption) {
                        cardStyle = 'bg-emerald-50 border-emerald-600 text-emerald-950';
                      } else if (isWrongChoice) {
                        cardStyle = 'bg-red-50 border-red-400 text-red-950';
                      } else {
                        cardStyle = 'bg-slate-50 border-slate-200 text-slate-500';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={
                          room.status !== 'QUESTION_ACTIVE' ||
                          Boolean(myParticipant?.hasAnsweredCurrent) ||
                          (!isMulti && selectedIndex !== null)
                        }
                        onClick={() =>
                          isMulti ? handleToggleMultiOption(idx) : handleSelectSingleAnswer(idx)
                        }
                        className={`p-4 min-h-[72px] rounded-xl border text-left transition-all flex flex-col justify-between gap-3 touch-manipulation ${cardStyle}`}
                      >
                        <div className="flex items-start justify-between gap-3 w-full">
                          <div className="flex items-start gap-3">
                            <span className="w-8 h-8 rounded-lg bg-slate-200/80 text-slate-900 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                              {OPTION_LABELS[idx] || String(idx + 1)}
                            </span>
                            <span className="text-sm sm:text-base font-semibold leading-relaxed">
                              {optText}
                            </span>
                          </div>

                          {isRevealed && isCorrectOption && (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          )}
                          {isRevealed && isWrongChoice && (
                            <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                          )}
                        </div>

                        {isRevealed && (
                          <div className="flex items-center justify-between w-full pt-2 border-t border-black/5 text-xs">
                            <span>
                              {isCorrectOption
                                ? 'Đáp án đúng'
                                : isMyChoice
                                ? 'Lựa chọn của bạn (Chưa đúng)'
                                : 'Phương án nhiễu'}
                            </span>
                            <span className="font-mono tabular-nums">
                              {voteCount} lượt chọn
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Multi-Choice Submit Button */}
                {currentQuestionType === 'MULTIPLE_CHOICE' &&
                  room.status === 'QUESTION_ACTIVE' &&
                  !myParticipant?.hasAnsweredCurrent && (
                    <div className="mb-5 flex justify-end">
                      <button
                        type="button"
                        disabled={selectedMultiIndices.length === 0}
                        onClick={handleSubmitMultiAnswer}
                        className="px-5 py-2.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 rounded-lg inline-flex items-center gap-2"
                      >
                        <CheckSquare className="w-4 h-4" />
                        <span>
                          Gửi {selectedMultiIndices.length} phương án đã chọn lên máy chủ
                        </span>
                      </button>
                    </div>
                  )}

                {/* Feedback Banner */}
                {(room.status === 'QUESTION_ACTIVE' || room.status === 'PAUSED') &&
                  (selectedIndex !== null || myParticipant?.hasAnsweredCurrent) && (
                    <div className="p-4 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-700 flex items-center justify-between">
                      <span>
                        Đã khóa phương án trả lời của bạn trên máy chủ. Đáp án đúng sẽ hiển thị khi kết thúc câu hỏi.
                      </span>
                      <span className="font-mono font-semibold text-emerald-700">
                        Đã ghi nhận
                      </span>
                    </div>
                  )}

                {room.status === 'QUESTION_REVEAL' && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
                      <span
                        className={
                          myParticipant?.lastAnswerCorrect
                            ? 'text-emerald-700'
                            : (myParticipant?.lastEarnedPoints || 0) < 0
                            ? 'text-red-700'
                            : 'text-slate-700'
                        }
                      >
                        {myParticipant?.lastAnswerCorrect
                          ? `Chính xác! Bạn nhận được +${myParticipant.lastEarnedPoints} điểm (Chuỗi đúng: ${myParticipant.streak})`
                          : (myParticipant?.lastEarnedPoints || 0) < 0
                          ? `Trả lời sai trong chế độ Thử thách (${myParticipant?.lastEarnedPoints} điểm).`
                          : 'Bạn chưa giành được điểm ở câu hỏi này.'}
                      </span>
                      <span className="font-mono text-slate-900 tabular-nums">
                        Tổng điểm hiện tại: {myParticipant?.score || 0}
                      </span>
                    </div>
                    {room.revealedExplanation && (
                      <p className="text-xs text-slate-600 leading-relaxed pt-1 border-t border-slate-200">
                        <strong className="text-slate-900">Giải thích:</strong>{' '}
                        {room.revealedExplanation}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Section X: Teacher Match Control Console */}
              {canControlRoom && (
                <div className="mt-6 pt-4 border-t border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">
                      Bảng điều khiển Giáo viên · Tiến độ trả lời:{' '}
                      <strong className="font-mono text-slate-900 tabular-nums">
                        {answeredCount}/{room.participants.length} ({answerProgressPercent}%)
                      </strong>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {(room.status === 'QUESTION_ACTIVE' || room.status === 'PAUSED') && (
                        <>
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={handleTogglePauseResume}
                            className="px-3.5 py-2 text-xs font-semibold text-slate-900 bg-amber-100 hover:bg-amber-200 rounded-lg inline-flex items-center gap-1.5 transition-colors"
                          >
                            {room.status === 'PAUSED' ? (
                              <>
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Tiếp tục đếm giờ</span>
                              </>
                            ) : (
                              <>
                                <Pause className="w-3.5 h-3.5" />
                                <span>Tạm dừng</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={handleForceReveal}
                            className="px-3.5 py-2 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Công bố đáp án</span>
                          </button>
                        </>
                      )}

                      {room.status === 'QUESTION_REVEAL' && (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={handleAdvanceRoom}
                          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 transition-colors"
                        >
                          <span>
                            {room.currentQuestionIndex + 1 >= room.totalQuestions
                              ? 'Tổng kết & Xem bảng xếp hạng chung cuộc'
                              : `Chuyển sang câu hỏi ${room.currentQuestionIndex + 2}`}
                          </span>
                          <SkipForward className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {confirmEndMatch ? (
                        <div className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg text-xs">
                          <span className="text-red-800 font-semibold">Kết thúc trận đấu?</span>
                          <button
                            type="button"
                            onClick={handleEndMatchEarly}
                            className="font-bold text-red-700 underline"
                          >
                            Xác nhận
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmEndMatch(false)}
                            className="text-slate-500 ml-1"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmEndMatch(true)}
                          className="px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg inline-flex items-center gap-1 transition-colors"
                        >
                          <Square className="w-3 h-3 fill-current" />
                          <span>Kết thúc trận</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section IX: Right Sidebar Real-Time Room Standings */}
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
              {room.isTeamMode && room.teams && room.teams.length > 0 && (
                <div className="space-y-2.5 pb-4 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-950">
                      Bảng xếp hạng Đội trực tiếp
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      {room.teamPlayFormat === 'CAPTAIN_REPRESENTATIVE'
                        ? 'Đội trưởng chốt'
                        : room.teamPlayFormat === 'TURN_BY_TURN'
                          ? 'Luân phiên'
                          : room.teamPlayFormat === 'TEAM_CONSENSUS'
                            ? 'Đồng thuận'
                            : 'Điểm TB Đội'}
                    </span>
                  </div>
                  <div className="space-y-2 tabular-nums">
                    {room.teams.map((t, idx) => (
                      <div
                        key={t.id}
                        className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-slate-700">
                            #{idx + 1}
                          </span>
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: t.colorHex }}
                          />
                          <span className="text-xs font-bold text-slate-950">
                            {t.name}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-mono font-bold text-slate-950">
                            {t.totalScore} đ
                          </span>
                          <span className="text-[10px] text-slate-500 ml-1.5">
                            ({t.correctCount} câu)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                  <h4 className="text-sm font-bold text-slate-950">
                    Bảng xếp hạng Cá nhân trực tiếp
                  </h4>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {onlineCount}/{room.participants.length} trực tuyến
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[420px] overflow-y-auto">
                  {room.participants.map((p, index) => (
                    <div
                      key={p.userId}
                      className={`p-3 rounded-lg border transition-all duration-300 flex items-center justify-between ${
                        p.userId === currentUser.id
                          ? 'bg-amber-50/60 border-amber-300'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded bg-slate-200 text-slate-800 font-mono text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                          {index + 1}
                        </span>
                        <div className="truncate">
                          <div className="text-xs font-semibold text-slate-900 truncate flex items-center gap-1.5">
                            <span className="truncate">{p.displayName}</span>
                            {p.teamName && (
                              <span className="text-[10px] text-slate-500">
                                [{p.teamName}]
                              </span>
                            )}
                            {!p.isOnline && (
                              <span className="text-[10px] text-slate-400">(Mất mạng)</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 tabular-nums">
                            {room.status === 'QUESTION_ACTIVE' || room.status === 'PAUSED'
                              ? p.hasAnsweredCurrent
                                ? 'Đã khóa đáp án'
                                : 'Đang suy nghĩ...'
                              : `Đúng ${p.correctCount}/${p.answeredCount ?? room.currentQuestionIndex + 1} câu`}
                            {p.avgResponseTimeMs
                              ? ` · TB ${(p.avgResponseTimeMs / 1000).toFixed(1)}s`
                              : ''}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-mono font-bold text-slate-950 tabular-nums">
                          {p.score}
                        </div>
                        {room.status === 'QUESTION_REVEAL' && p.lastEarnedPoints !== 0 && (
                          <div
                            className={`text-[11px] font-mono tabular-nums ${
                              p.lastEarnedPoints > 0 ? 'text-emerald-700' : 'text-red-600'
                            }`}
                          >
                            {p.lastEarnedPoints > 0
                              ? `+${p.lastEarnedPoints}`
                              : p.lastEarnedPoints}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      {/* PHASE 4: FINISHED PODIUM & FINAL RESULTS */}
      {room.status === 'FINISHED' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200">
            <div>
              <div className="text-xs font-semibold text-amber-700 mb-1">
                Trận đấu đã hoàn tất &amp; Lưu vào cơ sở dữ liệu
              </div>
              <h3 className="text-2xl font-bold text-slate-950">
                Bảng vàng kết quả chung cuộc — {room.title}
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onViewHistory}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                Xem chi tiết từng câu trả lời
              </button>
              <button
                type="button"
                onClick={onExitRoom}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Quay về bảng điều khiển
              </button>
            </div>
          </div>

          {/* Winning Team Podium if Team Mode */}
          {room.isTeamMode && room.teams && room.teams.length > 0 && (
            <div className="space-y-3 pb-4 border-b border-slate-200">
              <h4 className="text-sm font-bold text-slate-950">
                Kết quả Chung cuộc Các Đội (Team Arena)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 tabular-nums">
                {room.teams.map((t, idx) => (
                  <div
                    key={t.id}
                    className={`p-4 rounded-xl border ${
                      idx === 0
                        ? 'bg-amber-50/80 border-amber-400'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-mono font-bold text-slate-800">
                        Đội Hạng #{idx + 1}
                      </span>
                      <span>{t.memberCount} thành viên</span>
                    </div>
                    <div className="text-base font-bold text-slate-950 flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: t.colorHex }}
                      />
                      <span>{t.name}</span>
                    </div>
                    <div className="text-2xl font-mono font-bold text-slate-950 mt-1">
                      {t.totalScore} điểm
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top 3 Podium Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {room.participants.slice(0, 3).map((p, idx) => (
              <div
                key={p.userId}
                className={`p-5 rounded-xl border ${
                  idx === 0
                    ? 'bg-amber-50/70 border-amber-300'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-slate-700">
                    Hạng #{idx + 1}
                  </span>
                  <Trophy
                    className={`w-5 h-5 ${
                      idx === 0 ? 'text-amber-600' : 'text-slate-400'
                    }`}
                  />
                </div>
                <div className="text-base font-bold text-slate-950 mb-1">
                  {p.displayName}
                </div>
                <div className="text-2xl font-mono font-bold text-slate-950 tabular-nums">
                  {p.score} điểm
                </div>
                <div className="text-xs text-slate-500 mt-1 tabular-nums">
                  Trả lời đúng: {p.correctCount} / {room.totalQuestions} câu
                  {p.avgResponseTimeMs
                    ? ` · Phản xạ TB: ${(p.avgResponseTimeMs / 1000).toFixed(1)}s`
                    : ''}
                </div>
              </div>
            ))}
          </div>

          {/* Complete Results Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-3 px-4 font-semibold">Thứ hạng</th>
                  <th className="py-3 px-4 font-semibold">Người tham gia</th>
                  <th className="py-3 px-4 font-semibold">Vai trò</th>
                  <th className="py-3 px-4 font-semibold text-right">Đã trả lời</th>
                  <th className="py-3 px-4 font-semibold text-right">Số câu đúng</th>
                  <th className="py-3 px-4 font-semibold text-right">Phản xạ TB</th>
                  <th className="py-3 px-4 font-semibold text-right">Tổng điểm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {room.participants.map((p, idx) => (
                  <tr key={p.userId} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-semibold tabular-nums">
                      #{idx + 1}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {p.displayName}
                      {p.userId === currentUser.id ? ' (Bạn)' : ''}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {p.role === 'TEACHER'
                        ? 'Giáo viên'
                        : p.role === 'ADMIN'
                        ? 'Quản trị viên'
                        : 'Học sinh'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {p.answeredCount ?? room.totalQuestions}/{room.totalQuestions}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {p.correctCount}/{room.totalQuestions}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-slate-600 tabular-nums">
                      {p.avgResponseTimeMs
                        ? `${(p.avgResponseTimeMs / 1000).toFixed(1)}s`
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-950 tabular-nums">
                      {p.score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
