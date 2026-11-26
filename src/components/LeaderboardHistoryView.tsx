import React, { useEffect, useState } from 'react';
import { Trophy, History, CheckCircle2, XCircle, Eye, Filter, Shield, Award } from 'lucide-react';
import { api } from '../services/apiClient.ts';
import type {
  Classroom,
  MatchHistoryRecord,
  MatchSubmissionDetail,
  UserProfile,
} from '../types/arena.ts';

interface LeaderboardHistoryViewProps {
  mode: 'LEADERBOARD' | 'HISTORY';
  currentUser: UserProfile;
  classrooms?: Classroom[];
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

export const LeaderboardHistoryView: React.FC<LeaderboardHistoryViewProps> = ({
  mode,
  currentUser,
  classrooms = [],
}) => {
  const [boardType, setBoardType] = useState<
    'OVERALL' | 'MATCH' | 'CLASS' | 'SUBJECT' | 'WEEKLY' | 'MONTHLY' | 'SEASON'
  >('OVERALL');
  const [metric, setMetric] = useState<
    'MATCH_SCORE' | 'XP' | 'ACHIEVEMENT_POINTS' | 'TOURNAMENT_POINTS'
  >('MATCH_SCORE');
  const [filterClassroomId, setFilterClassroomId] = useState<string>('');
  const [filterSubject, setFilterSubject] = useState<string>('');
  const [filterGradeLevel, setFilterGradeLevel] = useState<string>('');
  const [anonymizeStudents, setAnonymizeStudents] = useState<boolean>(false);

  const [multiRows, setMultiRows] = useState<
    Array<{
      rank: number;
      userId: string;
      fullName: string;
      displayName: string;
      role: string;
      schoolName: string;
      className: string;
      matchScore: number;
      totalXp: number;
      level: number;
      levelTitle: string;
      achievementPoints: number;
      tournamentPoints: number;
      matchesPlayed: number;
      totalCorrect: number;
      accuracyPercent: number;
      badgeCount: number;
      primaryMetricValue: number;
      primaryMetricLabel: string;
    }>
  >([]);
  const [metricLabel, setMetricLabel] = useState<string>('Điểm trận đấu');

  const [history, setHistory] = useState<MatchHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedMatch, setSelectedMatch] = useState<MatchHistoryRecord | null>(null);
  const [submissions, setSubmissions] = useState<MatchSubmissionDetail[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      try {
        if (mode === 'LEADERBOARD') {
          const res = await api.getMultiDimensionalLeaderboard({
            boardType,
            metric,
            classroomId: filterClassroomId || undefined,
            subject: filterSubject || undefined,
            gradeLevel: filterGradeLevel || undefined,
            anonymize: anonymizeStudents,
          });
          if (active) {
            setMultiRows(res.entries);
            setMetricLabel(res.metricLabel);
          }
        } else {
          const res = await api.getHistory();
          if (active) {
            setHistory(res.history);
            if (res.history.length > 0 && !selectedMatch) {
              handleInspectMatch(res.history[0]);
            }
          }
        }
      } catch {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => {
      active = false;
    };
  }, [
    mode,
    boardType,
    metric,
    filterClassroomId,
    filterSubject,
    filterGradeLevel,
    anonymizeStudents,
  ]);

  const handleInspectMatch = async (match: MatchHistoryRecord) => {
    setSelectedMatch(match);
    setLoadingSubmissions(true);
    try {
      const res = await api.getMatchSubmissions(match.id);
      setSubmissions(res.submissions);
    } catch {
      setSubmissions([]);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  if (mode === 'LEADERBOARD') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">
              Bảng xếp hạng Đa chiều &amp; Thành tích Học thuật
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Phân tách minh bạch giữa Điểm trận đấu, Điểm kinh nghiệm (XP), Điểm thành tích và Điểm giải đấu. Không cộng lẫn các loại điểm khác bản chất.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-100 px-3.5 py-2 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={anonymizeStudents}
              onChange={(e) => setAnonymizeStudents(e.target.checked)}
            />
            <Shield className="w-4 h-4 text-slate-700" />
            <span>Ẩn danh học sinh trên bảng công khai</span>
          </label>
        </div>

        {/* 7 Board Category Tabs & 4 Distinct Score Metrics */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'OVERALL', label: 'Tổng thành tích' },
              { id: 'MATCH', label: 'Theo trận đấu' },
              { id: 'CLASS', label: 'Theo lớp học' },
              { id: 'SUBJECT', label: 'Theo môn học' },
              { id: 'WEEKLY', label: 'Theo tuần (7 ngày)' },
              { id: 'MONTHLY', label: 'Theo tháng (30 ngày)' },
              { id: 'SEASON', label: 'Theo mùa giải (90 ngày)' },
            ].map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBoardType(b.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  boardType === b.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Thước đo xếp hạng chính (Tách biệt)
              </label>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value as any)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 font-semibold"
              >
                <option value="MATCH_SCORE">1. Điểm trận đấu chính thức</option>
                <option value="XP">2. Điểm kinh nghiệm (XP &amp; Cấp độ)</option>
                <option value="ACHIEVEMENT_POINTS">3. Điểm thành tích &amp; Huy hiệu</option>
                <option value="TOURNAMENT_POINTS">4. Điểm giải đấu nhiều vòng</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Lọc theo Lớp học
              </label>
              <select
                value={filterClassroomId}
                onChange={(e) => setFilterClassroomId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900"
              >
                <option value="">Tất cả các lớp</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.gradeLevel})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Lọc theo Môn học
              </label>
              <input
                type="text"
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                placeholder="VD: Toán học, Vật lý, Tin học..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Lọc theo Khối lớp
              </label>
              <input
                type="text"
                value={filterGradeLevel}
                onChange={(e) => setFilterGradeLevel(e.target.value)}
                placeholder="VD: 10, 11, 12..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Top 3 Highlight Cards */}
        {multiRows.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {multiRows.slice(0, 3).map((entry, idx) => (
              <div
                key={entry.userId}
                className={`p-5 rounded-xl border ${
                  idx === 0
                    ? 'bg-amber-50/70 border-amber-300'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span className="font-mono font-bold text-slate-900">
                    Hạng #{entry.rank}
                  </span>
                  <span>
                    Cấp {entry.level} · {entry.levelTitle}
                  </span>
                </div>
                <div className="text-base font-bold text-slate-950 mb-1">
                  {entry.displayName}
                  {entry.userId === currentUser.id ? ' (Bạn)' : ''}
                </div>
                <div className="text-2xl font-mono font-bold text-slate-950 tabular-nums">
                  {entry.primaryMetricValue.toLocaleString('vi-VN')}
                  <span className="text-xs font-normal text-slate-500 ml-1.5">
                    ({metricLabel})
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-2 flex flex-wrap items-center gap-2 tabular-nums">
                  <span>{entry.matchesPlayed} trận</span>
                  <span aria-hidden="true">·</span>
                  <span>Chính xác: {entry.accuracyPercent}%</span>
                  <span aria-hidden="true">·</span>
                  <span>{entry.badgeCount} huy hiệu</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Full Leaderboard Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-xs text-slate-500">
              Đang tải bảng xếp hạng...
            </div>
          ) : multiRows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Không tìm thấy dữ liệu phù hợp với bộ lọc hiện tại.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                    <th className="py-3 px-4 font-semibold">Hạng</th>
                    <th className="py-3 px-4 font-semibold">Thành viên</th>
                    <th className="py-3 px-4 font-semibold">Cấp độ &amp; Huy hiệu</th>
                    <th className="py-3 px-4 font-semibold text-right">Điểm trận đấu</th>
                    <th className="py-3 px-4 font-semibold text-right">Kinh nghiệm (XP)</th>
                    <th className="py-3 px-4 font-semibold text-right">Điểm thành tích</th>
                    <th className="py-3 px-4 font-semibold text-right">Điểm giải đấu</th>
                    <th className="py-3 px-4 font-semibold text-right">Tỉ lệ đúng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm tabular-nums">
                  {multiRows.map((entry) => (
                    <tr
                      key={entry.userId}
                      className={
                        entry.userId === currentUser.id
                          ? 'bg-amber-50/40'
                          : 'hover:bg-slate-50'
                      }
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        #{entry.rank}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-950">
                          {entry.displayName}
                          {entry.userId === currentUser.id ? ' (Bạn)' : ''}
                        </div>
                        <div className="text-xs text-slate-500">
                          {entry.schoolName} · Lớp {entry.className}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="font-semibold text-slate-900">
                          Lv.{entry.level} – {entry.levelTitle}
                        </div>
                        <div className="text-slate-500 flex items-center gap-1">
                          <Award className="w-3.5 h-3.5 text-amber-600" />
                          <span>{entry.badgeCount} huy hiệu</span>
                        </div>
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono ${
                          metric === 'MATCH_SCORE'
                            ? 'font-bold text-slate-950'
                            : 'text-slate-600'
                        }`}
                      >
                        {entry.matchScore.toLocaleString('vi-VN')}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono ${
                          metric === 'XP'
                            ? 'font-bold text-emerald-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {entry.totalXp.toLocaleString('vi-VN')} XP
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono ${
                          metric === 'ACHIEVEMENT_POINTS'
                            ? 'font-bold text-amber-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {entry.achievementPoints.toLocaleString('vi-VN')}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono ${
                          metric === 'TOURNAMENT_POINTS'
                            ? 'font-bold text-orange-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {entry.tournamentPoints.toLocaleString('vi-VN')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-600">
                        {entry.accuracyPercent}% ({entry.matchesPlayed} trận)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // MATCH HISTORY VIEW
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-950">
            Lịch sử kết quả &amp; Chi tiết bài làm
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tra cứu các phòng thi đã kết thúc, điểm số đạt được và xem lại từng câu trả lời kèm giải thích.
          </p>
        </div>
        <History className="w-6 h-6 text-slate-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List of Completed Matches */}
        <div className="lg:col-span-5 space-y-3">
          {loading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
              Đang tải lịch sử trận đấu...
            </div>
          ) : history.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
              Chưa có trận đấu nào kết thúc.
            </div>
          ) : (
            history.map((m) => {
              const isSelected = selectedMatch?.id === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => handleInspectMatch(m)}
                  className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-white border-slate-900 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span className="font-mono">PIN: {m.roomCode}</span>
                    <span className="font-mono tabular-nums">
                      {new Date(m.finishedAt).toLocaleString('vi-VN')}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-950 mb-1">{m.roomTitle}</h3>
                  <div className="text-xs text-slate-500 mb-3">
                    Bộ đề: {m.questionSetTitle} · {m.participantCount} người tham gia
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    {m.userScore !== undefined ? (
                      <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                        Điểm của bạn: {m.userScore} (Đúng {m.userCorrectCount}/
                        {m.totalQuestions})
                      </span>
                    ) : (
                      <span className="text-slate-400">Chủ phòng: {m.hostName}</span>
                    )}
                    <span className="font-semibold text-slate-900 inline-flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Chi tiết</span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Submission Inspector */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          {!selectedMatch ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Chọn một trận đấu ở danh sách bên trái để xem chi tiết từng câu trả lời.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="pb-4 border-b border-slate-200">
                <div className="text-xs text-slate-500 mb-1">
                  Mã phòng: <strong className="font-mono">{selectedMatch.roomCode}</strong> ·
                  Chủ phòng: {selectedMatch.hostName}
                </div>
                <h3 className="text-lg font-bold text-slate-950">
                  {selectedMatch.roomTitle}
                </h3>
              </div>

              {loadingSubmissions ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  Đang tải chi tiết bài làm...
                </div>
              ) : submissions.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  Bạn không có bản ghi trả lời cá nhân trong trận đấu này. Hãy chạy một lượt chơi thử nghiệm hoặc tham gia trả lời để lưu chi tiết từng câu.
                </div>
              ) : (
                <div className="space-y-4">
                  {submissions.map((sub, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-slate-800">
                          Câu {sub.questionIndex + 1}
                        </span>
                        <span
                          className={`font-semibold inline-flex items-center gap-1 ${
                            sub.isCorrect ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {sub.isCorrect ? (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Chính xác (+{sub.earnedPoints} điểm)</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4" />
                              <span>Chưa chính xác (0 điểm)</span>
                            </>
                          )}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-950">{sub.prompt}</h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {sub.options.map((opt, optIdx) => {
                          const isCorrect = sub.correctIndex === optIdx;
                          const isSelected = sub.selectedIndex === optIdx;
                          return (
                            <div
                              key={optIdx}
                              className={`px-3 py-2 rounded-lg border ${
                                isCorrect
                                  ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-semibold'
                                  : isSelected
                                  ? 'bg-red-50 border-red-400 text-red-950'
                                  : 'bg-white border-slate-200 text-slate-600'
                              }`}
                            >
                              <strong className="font-mono mr-1.5">
                                {OPTION_LETTERS[optIdx]}.
                              </strong>
                              {opt}
                            </div>
                          );
                        })}
                      </div>

                      {sub.explanation && (
                        <div className="text-xs text-slate-600 pt-2 border-t border-slate-200">
                          <strong className="text-slate-900">Giải thích:</strong>{' '}
                          {sub.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
