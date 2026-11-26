import React, { useEffect, useState } from 'react';
import {
  Plus,
  Play,
  ArrowRight,
  Copy,
  Trash2,
  GraduationCap,
  Radio,
  Search,
  Upload,
  Lock,
  Unlock,
  Edit3,
  RefreshCw,
  Award,
  ArrowLeftRight,
  UserPlus,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { api } from '../services/apiClient.ts';
import type {
  Classroom,
  ClassroomMember,
  GameMode,
  PaginationMetadata,
  QuestionSet,
  RoomAccessPolicy,
  RoomStatus,
  StudentAchievementDetail,
  StudentImportResult,
  StudentImportRowInput,
  UserProfile,
} from '../types/arena.ts';

interface TeacherStudentAreaProps {
  mode: 'TEACHER_AREA' | 'STUDENT_AREA';
  currentUser: UserProfile;
  classrooms: Classroom[];
  questionSets: QuestionSet[];
  activeRooms: Array<{
    id: string;
    code: string;
    title: string;
    questionSetTitle: string;
    hostName: string;
    status: RoomStatus;
    participantCount: number;
    isTestMode: boolean;
  }>;
  onRefreshData: () => Promise<void>;
  onCreateAndEnterRoom: (params: {
    questionSetId: string;
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
  }) => Promise<void>;
  onJoinRoomByPin: (pin: string, displayName?: string) => Promise<void>;
}

interface ParsedCsvPreviewRow extends StudentImportRowInput {
  isValid: boolean;
  validationMessage: string;
}

export const TeacherStudentArea: React.FC<TeacherStudentAreaProps> = ({
  mode,
  currentUser,
  classrooms,
  questionSets,
  activeRooms,
  onRefreshData,
  onCreateAndEnterRoom,
  onJoinRoomByPin,
}) => {
  const canManageClasses = currentUser.role === 'ADMIN' || currentUser.role === 'TEACHER';

  // Sub-tabs inside Teacher Area
  const [teacherSection, setTeacherSection] = useState<
    'CLASSROOMS' | 'STUDENTS' | 'CSV_IMPORT' | 'LIVE_ROOMS'
  >('CLASSROOMS');

  // Classroom creation form state
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [className, setClassName] = useState('');
  const [classSubject, setClassSubject] = useState('Toán học & KHTN');
  const [classGrade, setClassGrade] = useState('Khối 12');
  const [classDesc, setClassDesc] = useState('');
  const [classCustomCode, setClassCustomCode] = useState('');

  // Selected classroom & Edit classroom state
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>(
    classrooms[0]?.id || ''
  );
  const [members, setMembers] = useState<ClassroomMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [editingClass, setEditingClass] = useState(false);
  const [editClassName, setEditClassName] = useState('');
  const [editClassSubject, setEditClassSubject] = useState('');
  const [editClassGrade, setEditClassGrade] = useState('');
  const [editClassDesc, setEditClassDesc] = useState('');

  // Add student to classroom by email/username
  const [addStudentIdentifier, setAddStudentIdentifier] = useState('');
  // Confirmation before removing member from class
  const [confirmRemoveStudentId, setConfirmRemoveStudentId] = useState<string | null>(null);

  // Room creation state (Teacher - Prompt 3 Section II)
  const [roomTitle, setRoomTitle] = useState('');
  const [roomDesc, setRoomDesc] = useState('');
  const [roomSetId, setRoomSetId] = useState(questionSets[0]?.id || '');
  const [roomClassId, setRoomClassId] = useState<string>('');
  const [roomQuestionLimit, setRoomQuestionLimit] = useState<number>(10);
  const [roomTimeLimitSec, setRoomTimeLimitSec] = useState<number>(20);
  const [roomMaxPoints, setRoomMaxPoints] = useState<number>(1000);
  const [roomGameMode, setRoomGameMode] = useState<GameMode>('SPEED_PRECISION');
  const [roomMaxParticipants, setRoomMaxParticipants] = useState<number>(100);
  const [roomAccessPolicy, setRoomAccessPolicy] = useState<RoomAccessPolicy>('ANY_AUTHENTICATED');
  const [roomIsPublic, setRoomIsPublic] = useState<boolean>(true);

  // Student Join Forms
  const [joinClassCode, setJoinClassCode] = useState('');
  const [joinRoomPin, setJoinRoomPin] = useState('');
  const [joinDisplayName, setJoinDisplayName] = useState('');
  const [practiceSetId, setPracticeSetId] = useState(questionSets[0]?.id || '');

  // Student Management State (Section 5)
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [studentPagination, setStudentPagination] = useState<PaginationMetadata | null>(null);
  const [studentPage, setStudentPage] = useState(1);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentFilterClassId, setStudentFilterClassId] = useState('');
  const [studentFilterStatus, setStudentFilterStatus] = useState<'ALL' | 'ACTIVE' | 'LOCKED'>('ALL');
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Create / Edit / Lock / Transfer / Achievements for Student
  const [showAddStudentForm, setShowAddStudentForm] = useState(false);
  const [newStdFullName, setNewStdFullName] = useState('');
  const [newStdEmail, setNewStdEmail] = useState('');
  const [newStdUsername, setNewStdUsername] = useState('');
  const [newStdSchool, setNewStdSchool] = useState(currentUser.schoolName || '');
  const [newStdClassroomId, setNewStdClassroomId] = useState('');
  const [newStdPassword, setNewStdPassword] = useState('');

  const [editingStudent, setEditingStudent] = useState<UserProfile | null>(null);
  const [editStdFullName, setEditStdFullName] = useState('');
  const [editStdUsername, setEditStdUsername] = useState('');
  const [editStdSchool, setEditStdSchool] = useState('');
  const [editStdClassName, setEditStdClassName] = useState('');
  const [editStdPassword, setEditStdPassword] = useState('');

  const [confirmLockStudentId, setConfirmLockStudentId] = useState<string | null>(null);

  const [transferStudentTarget, setTransferStudentTarget] = useState<UserProfile | null>(null);
  const [transferFromClassId, setTransferFromClassId] = useState('');
  const [transferToClassId, setTransferToClassId] = useState('');

  const [selectedAchievement, setSelectedAchievement] = useState<StudentAchievementDetail | null>(
    null
  );
  const [loadingAchievement, setLoadingAchievement] = useState(false);

  // CSV / Excel Bulk Import State
  const [csvRawText, setCsvRawText] = useState(
    `Họ và tên,Email,Tên đăng nhập,Trường học,Mã lớp\nNguyễn Minh Khôi,minhkhoi.12a1@quizzi.edu.vn,minhkhoi12a1,THPT Chuyên Khoa Học Tự Nhiên,TOAN12A1\nTrần Bảo Ngọc,baongoc.12a1@quizzi.edu.vn,baongoc12a1,THPT Chuyên Khoa Học Tự Nhiên,TOAN12A1\nLê Hoàng Nam,hoangnam.11pro@quizzi.edu.vn,hoangnam11pro,THPT Chuyên Khoa Học Tự Nhiên,TIN11PRO`
  );
  const [csvDefaultClassCode, setCsvDefaultClassCode] = useState('');
  const [csvPreviewRows, setCsvPreviewRows] = useState<ParsedCsvPreviewRow[]>([]);
  const [csvImportResult, setCsvImportResult] = useState<StudentImportResult | null>(null);
  const [importingCsv, setImportingCsv] = useState(false);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedClassroomId && classrooms.length > 0) {
      setSelectedClassroomId(classrooms[0].id);
    }
  }, [classrooms, selectedClassroomId]);

  useEffect(() => {
    if (!roomSetId && questionSets.length > 0) {
      setRoomSetId(questionSets[0].id);
      setPracticeSetId(questionSets[0].id);
    }
  }, [questionSets, roomSetId]);

  const selectedClassroom =
    classrooms.find((c) => c.id === selectedClassroomId) || null;

  useEffect(() => {
    if (selectedClassroom) {
      setEditClassName(selectedClassroom.name);
      setEditClassSubject(selectedClassroom.subject);
      setEditClassGrade(selectedClassroom.gradeLevel);
      setEditClassDesc(selectedClassroom.description);
    }
  }, [selectedClassroom]);

  const loadMembers = async (clsId: string) => {
    if (!clsId) return;
    setLoadingMembers(true);
    try {
      const res = await api.getClassroomMembers(clsId);
      setMembers(res.members);
    } catch {
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (selectedClassroomId) {
      loadMembers(selectedClassroomId);
    }
  }, [selectedClassroomId]);

  const loadStudentsDirectory = async () => {
    if (!canManageClasses) return;
    setLoadingStudents(true);
    try {
      const res = await api.listStudents({
        search: studentSearch.trim() || undefined,
        classroomId: studentFilterClassId || undefined,
        status: studentFilterStatus,
        page: studentPage,
        limit: 20,
      });
      setStudents(res.students);
      setStudentPagination(res.pagination);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể tải danh sách học sinh.');
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    if (mode === 'TEACHER_AREA' && teacherSection === 'STUDENTS' && canManageClasses) {
      loadStudentsDirectory();
    }
  }, [
    mode,
    teacherSection,
    studentPage,
    studentFilterClassId,
    studentFilterStatus,
    canManageClasses,
  ]);

  // Parse CSV/Excel TSV text into Preview Table
  const handleAnalyzeCsv = (rawInput: string, fallbackClassCode: string) => {
    const lines = rawInput
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setCsvPreviewRows([]);
      return;
    }

    const parsed: ParsedCsvPreviewRow[] = [];
    const seenEmails = new Set<string>();
    const seenUsernames = new Set<string>();

    lines.forEach((line, idx) => {
      // Split by comma, semicolon, or tab (for Excel paste)
      const cols = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ''));

      // Skip header row if first row contains 'email' or 'họ và tên'
      if (
        idx === 0 &&
        (cols.some((c) => c.toLowerCase().includes('email')) ||
          cols.some((c) => c.toLowerCase().includes('họ và tên')))
      ) {
        return;
      }

      const rowNumber = idx + 1;
      const fullName = cols[0] || '';
      const email = (cols[1] || '').toLowerCase();
      const username = (cols[2] || '').toLowerCase();
      const schoolName = cols[3] || currentUser.schoolName || 'THPT Chuyên';
      const classroomCode = (cols[4] || fallbackClassCode || '').toUpperCase();

      const errors: string[] = [];
      if (!fullName || fullName.length < 2) {
        errors.push('Thiếu họ tên');
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('Email không hợp lệ');
      } else if (seenEmails.has(email)) {
        errors.push('Trùng email trong file');
      } else {
        seenEmails.add(email);
      }

      if (username) {
        if (seenUsernames.has(username)) {
          errors.push('Trùng tên đăng nhập trong file');
        } else {
          seenUsernames.add(username);
        }
      }

      parsed.push({
        rowNumber,
        fullName,
        email,
        username: username || undefined,
        schoolName,
        classroomCode: classroomCode || undefined,
        isValid: errors.length === 0,
        validationMessage: errors.length === 0 ? 'Hợp lệ' : errors.join(', '),
      });
    });

    setCsvPreviewRows(parsed);
  };

  useEffect(() => {
    if (teacherSection === 'CSV_IMPORT') {
      handleAnalyzeCsv(csvRawText, csvDefaultClassCode);
    }
  }, [csvRawText, csvDefaultClassCode, teacherSection]);

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result || '');
      setCsvRawText(content);
      setCsvImportResult(null);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleConfirmCsvImport = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    if (csvPreviewRows.length === 0) {
      setErrorMessage('Chưa có dữ liệu học sinh để nhập.');
      return;
    }
    setImportingCsv(true);
    try {
      const res = await api.bulkImportStudents(csvPreviewRows);
      setCsvImportResult(res.result);
      await onRefreshData();
      if (selectedClassroomId) {
        await loadMembers(selectedClassroomId);
      }
      setStatusMessage(
        `Hoàn tất nhập dữ liệu: Tạo mới ${res.result.importedCount} tài khoản, ghi danh ${res.result.enrolledCount} học sinh vào lớp, bỏ qua ${res.result.skippedCount} dòng lỗi.`
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Lỗi khi nhập danh sách học sinh.');
    } finally {
      setImportingCsv(false);
    }
  };

  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await api.createClassroom({
        name: className,
        subject: classSubject,
        gradeLevel: classGrade,
        description: classDesc,
        customCode: classCustomCode.trim() || undefined,
      });
      await onRefreshData();
      setSelectedClassroomId(res.classroom.id);
      setShowCreateClass(false);
      setClassName('');
      setClassDesc('');
      setClassCustomCode('');
      setStatusMessage(
        `Đã tạo lớp học "${res.classroom.name}" với mã tham gia: ${res.classroom.code}`
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể tạo lớp học.');
    }
  };

  const handleSaveClassroomEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassroom) return;
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await api.updateClassroom(selectedClassroom.id, {
        name: editClassName,
        subject: editClassSubject,
        gradeLevel: editClassGrade,
        description: editClassDesc,
      });
      await onRefreshData();
      setEditingClass(false);
      setStatusMessage(`Đã cập nhật thông tin lớp "${res.classroom.name}".`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể cập nhật thông tin lớp học.');
    }
  };

  const handleToggleLockClassroom = async (cls: Classroom) => {
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await api.updateClassroom(cls.id, {
        isLocked: !cls.isLocked,
      });
      await onRefreshData();
      setStatusMessage(
        res.classroom.isLocked
          ? `Đã khóa lớp "${res.classroom.name}" (Học sinh mới không thể tự gia nhập).`
          : `Đã mở khóa lớp "${res.classroom.name}".`
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể thay đổi trạng thái khóa lớp.');
    }
  };

  const handleRegenerateClassCode = async (cls: Classroom) => {
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await api.updateClassroom(cls.id, {
        regenerateCode: true,
      });
      await onRefreshData();
      setStatusMessage(`Đã cấp mã tham gia mới cho lớp: ${res.classroom.code}`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể đổi mã lớp.');
    }
  };

  const handleAddStudentToClassByIdentifier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassroom || !addStudentIdentifier.trim()) return;
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await api.addStudentToClassroom(
        selectedClassroom.id,
        addStudentIdentifier.trim()
      );
      setMembers(res.members);
      setAddStudentIdentifier('');
      await onRefreshData();
      setStatusMessage('Đã thêm học sinh vào lớp học thành công.');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể thêm học sinh vào lớp.');
    }
  };

  const handleRemoveMember = async (studentId: string) => {
    if (!selectedClassroomId) return;
    setErrorMessage(null);
    try {
      const res = await api.removeClassroomMember(selectedClassroomId, studentId);
      setMembers(res.members);
      setConfirmRemoveStudentId(null);
      await onRefreshData();
      setStatusMessage('Đã xóa học sinh khỏi danh sách lớp.');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể xóa học sinh khỏi lớp.');
    }
  };

  const handleJoinClassByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinClassCode.trim()) return;
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await api.joinClassroom(joinClassCode.trim());
      await onRefreshData();
      setSelectedClassroomId(res.classroom.id);
      setJoinClassCode('');
      setStatusMessage(`Đã gia nhập lớp "${res.classroom.name}" thành công!`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể tham gia lớp học.');
    }
  };

  const handleCreateLiveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      await onCreateAndEnterRoom({
        questionSetId: roomSetId,
        title: roomTitle.trim() || undefined,
        description: roomDesc.trim() || undefined,
        classroomId: roomClassId || null,
        isTestMode: false,
        questionLimit: roomQuestionLimit,
        timeLimitOverrideSec: roomTimeLimitSec > 0 ? roomTimeLimitSec : null,
        pointsOverride: roomMaxPoints > 0 ? roomMaxPoints : null,
        gameMode: roomGameMode,
        maxParticipants: roomMaxParticipants,
        accessPolicy: roomAccessPolicy,
        isPublic: roomIsPublic,
      });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể khởi tạo phòng thi đấu.');
    }
  };

  // Student Directory Handlers
  const handleCreateNewStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await api.createStudent({
        fullName: newStdFullName,
        email: newStdEmail,
        username: newStdUsername.trim() || undefined,
        schoolName: newStdSchool,
        classroomId: newStdClassroomId || undefined,
        password: newStdPassword.trim() || undefined,
      });
      setShowAddStudentForm(false);
      setNewStdFullName('');
      setNewStdEmail('');
      setNewStdUsername('');
      setNewStdPassword('');
      await loadStudentsDirectory();
      await onRefreshData();
      setStatusMessage(`Đã tạo tài khoản học sinh "${res.student.fullName}".`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể tạo học sinh.');
    }
  };

  const handleSaveStudentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await api.updateStudent(editingStudent.id, {
        fullName: editStdFullName,
        username: editStdUsername,
        schoolName: editStdSchool,
        className: editStdClassName,
        newPassword: editStdPassword.trim() ? editStdPassword.trim() : undefined,
      });
      setEditingStudent(null);
      setEditStdPassword('');
      setStudents((prev) => prev.map((s) => (s.id === res.student.id ? res.student : s)));
      setStatusMessage(`Đã cập nhật thông tin học sinh "${res.student.fullName}".`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể cập nhật học sinh.');
    }
  };

  const handleToggleStudentLock = async (student: UserProfile) => {
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await api.updateStudent(student.id, {
        isLocked: !student.isLocked,
      });
      setConfirmLockStudentId(null);
      setStudents((prev) => prev.map((s) => (s.id === res.student.id ? res.student : s)));
      setStatusMessage(
        res.student.isLocked
          ? `Đã khóa tài khoản học sinh "${res.student.fullName}".`
          : `Đã mở khóa tài khoản học sinh "${res.student.fullName}".`
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể khóa/mở khóa tài khoản.');
    }
  };

  const handleTransferStudentClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferStudentTarget || !transferToClassId) return;
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await api.transferStudentClassroom(transferStudentTarget.id, {
        fromClassroomId: transferFromClassId || null,
        toClassroomId: transferToClassId,
      });
      setTransferStudentTarget(null);
      await loadStudentsDirectory();
      await onRefreshData();
      if (selectedClassroomId) {
        await loadMembers(selectedClassroomId);
      }
      setStatusMessage(
        `Đã chuyển học sinh "${transferStudentTarget.fullName}" sang lớp "${res.targetClassroom.name}".`
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể chuyển lớp cho học sinh.');
    }
  };

  const handleInspectStudentAchievements = async (studentId: string) => {
    setLoadingAchievement(true);
    setErrorMessage(null);
    try {
      const res = await api.getStudentAchievements(studentId);
      setSelectedAchievement(res.achievement);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể tải thành tích học sinh.');
    } finally {
      setLoadingAchievement(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-950">
            {mode === 'TEACHER_AREA'
              ? 'Khu vực Giáo viên — Quản lý Lớp học, Học sinh & Tổ chức Thi đấu'
              : 'Khu vực Học sinh — Tham gia Phòng thi, Lớp học & Ôn luyện'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {mode === 'TEACHER_AREA'
              ? 'Quản lý danh sách lớp, thêm/chuyển lớp cho học sinh, nhập danh sách học sinh từ CSV/Excel và phát hành mã PIN thi đấu.'
              : 'Nhập mã PIN 6 số để vào phòng thi đấu trực tiếp, gia nhập lớp học bằng mã lớp hoặc tự mở lượt chơi thử nghiệm.'}
          </p>
        </div>

        {mode === 'TEACHER_AREA' && canManageClasses && (
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setTeacherSection('CLASSROOMS')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                teacherSection === 'CLASSROOMS'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Quản lý Lớp học ({classrooms.length})
            </button>
            <button
              type="button"
              onClick={() => setTeacherSection('STUDENTS')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                teacherSection === 'STUDENTS'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Quản lý Học sinh
            </button>
            <button
              type="button"
              onClick={() => setTeacherSection('CSV_IMPORT')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                teacherSection === 'CSV_IMPORT'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Nhập Học sinh (CSV / Excel)
            </button>
            <button
              type="button"
              onClick={() => setTeacherSection('LIVE_ROOMS')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                teacherSection === 'LIVE_ROOMS'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mở Phòng Thi PIN
            </button>
          </div>
        )}
      </div>

      {statusMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="underline font-semibold ml-3"
          >
            Đóng
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="underline font-semibold ml-3"
          >
            Đóng
          </button>
        </div>
      )}

      {/* STUDENT AREA TOP CONTROLS: Join Room by PIN, Join Class by Code, Launch Test Match */}
      {mode === 'STUDENT_AREA' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: Enter Live Room by PIN */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="text-xs font-semibold text-amber-700 mb-1">
                01. Thi đấu trực tiếp
              </div>
              <h3 className="text-base font-bold text-slate-950 mb-2">
                Tham gia phòng bằng mã PIN
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                Nhập mã phòng 6 chữ số do Giáo viên cung cấp và biệt danh hiển thị (nếu phòng cho phép).
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (joinRoomPin.trim()) {
                  onJoinRoomByPin(
                    joinRoomPin.trim(),
                    joinDisplayName.trim() || undefined
                  );
                }
              }}
              className="space-y-2"
            >
              <input
                type="text"
                value={joinDisplayName}
                onChange={(e) => setJoinDisplayName(e.target.value)}
                placeholder="Biệt danh hiển thị (Tùy chọn)..."
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={joinRoomPin}
                  onChange={(e) => setJoinRoomPin(e.target.value)}
                  placeholder="Mã PIN 6 số..."
                  className="flex-1 px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <span>Vào phòng</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>

          {/* Card 2: Join Classroom by Code */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1">
                02. Gia nhập lớp học
              </div>
              <h3 className="text-base font-bold text-slate-950 mb-2">
                Tham gia lớp bằng Mã lớp
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Nhập mã lớp (ví dụ: <code className="font-mono">TOAN12A1</code> hoặc{' '}
                <code className="font-mono">TIN11PRO</code>) để ghi danh vào lớp.
              </p>
            </div>
            <form onSubmit={handleJoinClassByCode} className="flex gap-2">
              <input
                type="text"
                required
                value={joinClassCode}
                onChange={(e) => setJoinClassCode(e.target.value)}
                placeholder="Nhập mã lớp..."
                className="flex-1 px-3.5 py-2 text-sm font-mono uppercase border border-slate-300 rounded-lg"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0"
              >
                Ghi danh
              </button>
            </form>
          </div>

          {/* Card 3: Launch Solo Test Match */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="text-xs font-semibold text-emerald-700 mb-1">
                03. Tự luyện phản xạ
              </div>
              <h3 className="text-base font-bold text-slate-950 mb-2">
                Tạo một lượt chơi thử nghiệm
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                Chọn bộ câu hỏi bất kỳ để tự thi đấu thử nghiệm có bấm giờ và chấm điểm từ máy chủ.
              </p>
            </div>
            <div className="space-y-2">
              <select
                value={practiceSetId}
                onChange={(e) => setPracticeSetId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {questionSets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.questionCount} câu)
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  onCreateAndEnterRoom({
                    questionSetId: practiceSetId,
                    isTestMode: true,
                  })
                }
                className="w-full py-2 px-4 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Bắt đầu lượt chơi thử nghiệm</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEACHER SECTION: LIVE ROOMS GENERATOR (PROMPT 3 SECTION II) */}
      {mode === 'TEACHER_AREA' && teacherSection === 'LIVE_ROOMS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
            <div className="text-xs font-semibold text-amber-700 mb-1">
              Tổ chức thi đấu thời gian thực (Game Engine Pro)
            </div>
            <h3 className="text-lg font-bold text-slate-950 mb-4">
              Tạo phòng chơi &amp; Sinh mã PIN cho học sinh
            </h3>

            {canManageClasses ? (
              <form onSubmit={handleCreateLiveRoom} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tên phòng thi đấu
                    </label>
                    <input
                      type="text"
                      value={roomTitle}
                      onChange={(e) => setRoomTitle(e.target.value)}
                      placeholder="VD: Kiểm tra 15 phút Vật Lý 12A1"
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mô tả phòng thi
                    </label>
                    <input
                      type="text"
                      value={roomDesc}
                      onChange={(e) => setRoomDesc(e.target.value)}
                      placeholder="Mô tả mục tiêu hoặc hướng dẫn thi..."
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Bộ câu hỏi sử dụng
                    </label>
                    <select
                      value={roomSetId}
                      onChange={(e) => setRoomSetId(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                    >
                      {questionSets.map((qs) => (
                        <option key={qs.id} value={qs.id}>
                          {qs.title} ({qs.questionCount} câu)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Lớp tham gia
                    </label>
                    <select
                      value={roomClassId}
                      onChange={(e) => {
                        setRoomClassId(e.target.value);
                        if (e.target.value) {
                          setRoomAccessPolicy('CLASSROOM_ONLY');
                        }
                      }}
                      className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="">Tất cả lớp (Không giới hạn lớp)</option>
                      {classrooms.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} (Mã: {c.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Số lượng câu hỏi
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={roomQuestionLimit}
                      onChange={(e) => setRoomQuestionLimit(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Thời gian / câu (s)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={180}
                      value={roomTimeLimitSec}
                      onChange={(e) => setRoomTimeLimitSec(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Số điểm tối đa / câu
                    </label>
                    <input
                      type="number"
                      min={100}
                      max={5000}
                      step={100}
                      value={roomMaxPoints}
                      onChange={(e) => setRoomMaxPoints(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Số người tối đa
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={roomMaxParticipants}
                      onChange={(e) => setRoomMaxParticipants(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Chế độ chơi &amp; Tính điểm
                    </label>
                    <select
                      value={roomGameMode}
                      onChange={(e) => setRoomGameMode(e.target.value as GameMode)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="SPEED_PRECISION">
                        Tốc độ &amp; Chính xác (+Thưởng tốc độ &amp; chuỗi đúng)
                      </option>
                      <option value="STANDARD">
                        Tiêu chuẩn (Điểm cố định, không thưởng tốc độ)
                      </option>
                      <option value="HIGH_STAKES">
                        Thách đấu Mạo hiểm (+Thưởng lớn, -20% khi sai)
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Quyền tham gia
                    </label>
                    <select
                      value={roomAccessPolicy}
                      onChange={(e) => setRoomAccessPolicy(e.target.value as RoomAccessPolicy)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="ANY_AUTHENTICATED">Mọi tài khoản có mã PIN</option>
                      <option value="CLASSROOM_ONLY">Chỉ học sinh thuộc lớp đã chọn</option>
                      <option value="ALLOW_GUEST">Cho phép đặt biệt danh tự do</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Hiển thị phòng
                    </label>
                    <select
                      value={roomIsPublic ? 'PUBLIC' : 'PRIVATE'}
                      onChange={(e) => setRoomIsPublic(e.target.value === 'PUBLIC')}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="PUBLIC">Công khai trên sảnh</option>
                      <option value="PRIVATE">Riêng tư (Chỉ vào bằng PIN/Link)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-2 transition-colors"
                  >
                    <Radio className="w-4 h-4 text-amber-400" />
                    <span>Khởi tạo phòng &amp; Sinh mã PIN 6 số</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onCreateAndEnterRoom({
                        questionSetId: roomSetId,
                        title: roomTitle.trim() || undefined,
                        isTestMode: true,
                      })
                    }
                    className="px-4 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 text-amber-600" />
                    <span>Chạy lượt chơi thử nghiệm</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                Bạn đang đăng nhập với vai trò Học sinh. Để mở phòng thi đấu chính thức và tạo lớp học, vui lòng chuyển sang tài khoản Giáo viên.
              </div>
            )}
          </div>

          {/* Active Live Rooms Panel */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-bold text-slate-950">
                Phòng thi đấu đang mở
              </h3>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                {activeRooms.length} phòng
              </span>
            </div>

            {activeRooms.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                Hiện chưa có phòng thi đấu nào đang mở. Hãy tạo phòng mới ở khung bên trái.
              </div>
            ) : (
              <div className="space-y-3">
                {activeRooms.map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono font-bold text-slate-900">
                          PIN: {r.code}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{r.participantCount} người</span>
                      </div>
                      <div className="text-sm font-bold text-slate-950 truncate">
                        {r.title}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onJoinRoomByPin(r.code)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0"
                    >
                      Vào phòng
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TEACHER SECTION: STUDENT DIRECTORY & MANAGEMENT (SECTION 5) */}
      {mode === 'TEACHER_AREA' && teacherSection === 'STUDENTS' && canManageClasses && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-950">
                  Danh mục Quản lý Học sinh Toàn diện
                </h3>
                <p className="text-xs text-slate-500">
                  Tìm kiếm, lọc theo lớp học và trạng thái, thêm học sinh mới, sửa hồ sơ, chuyển lớp, khóa/mở khóa và xem thành tích cá nhân.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTeacherSection('CSV_IMPORT')}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Nhập từ CSV / Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddStudentForm(!showAddStudentForm)}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Thêm học sinh mới</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStudentPage(1);
                loadStudentsDirectory();
              }}
              className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2"
            >
              <div className="sm:col-span-2 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Tìm học sinh theo họ tên, email, tên đăng nhập..."
                  className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <select
                value={studentFilterClassId}
                onChange={(e) => {
                  setStudentFilterClassId(e.target.value);
                  setStudentPage(1);
                }}
                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Tất cả lớp học</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <select
                  value={studentFilterStatus}
                  onChange={(e) => {
                    setStudentFilterStatus(e.target.value as 'ALL' | 'ACTIVE' | 'LOCKED');
                    setStudentPage(1);
                  }}
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="ALL">Mọi trạng thái</option>
                  <option value="ACTIVE">Đang hoạt động</option>
                  <option value="LOCKED">Đang bị khóa</option>
                </select>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shrink-0"
                >
                  Lọc
                </button>
              </div>
            </form>

            {/* Add New Student Inline Form */}
            {showAddStudentForm && (
              <form
                onSubmit={handleCreateNewStudent}
                className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 mt-3"
              >
                <div className="text-xs font-bold text-slate-900">
                  Tạo tài khoản Học sinh mới &amp; Ghi danh vào lớp
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Họ và tên học sinh *
                    </label>
                    <input
                      type="text"
                      required
                      value={newStdFullName}
                      onChange={(e) => setNewStdFullName(e.target.value)}
                      placeholder="VD: Phạm Gia Huy"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Địa chỉ Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={newStdEmail}
                      onChange={(e) => setNewStdEmail(e.target.value)}
                      placeholder="giahuy@school.edu.vn"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Tên đăng nhập (Tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={newStdUsername}
                      onChange={(e) => setNewStdUsername(e.target.value)}
                      placeholder="giahuy12a1"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Trường học
                    </label>
                    <input
                      type="text"
                      value={newStdSchool}
                      onChange={(e) => setNewStdSchool(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Xếp vào lớp học
                    </label>
                    <select
                      value={newStdClassroomId}
                      onChange={(e) => setNewStdClassroomId(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="">-- Chưa xếp lớp --</option>
                      {classrooms.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Mật khẩu khởi tạo (Mặc định: Student@123)
                    </label>
                    <input
                      type="text"
                      value={newStdPassword}
                      onChange={(e) => setNewStdPassword(e.target.value)}
                      placeholder="Student@123"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddStudentForm(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg"
                  >
                    Tạo học sinh
                  </button>
                </div>
              </form>
            )}

            {/* Edit Student Modal/Form */}
            {editingStudent && (
              <form
                onSubmit={handleSaveStudentEdit}
                className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3"
              >
                <div className="text-xs font-bold text-slate-900">
                  Chỉnh sửa thông tin Học sinh: {editingStudent.fullName} ({editingStudent.email})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Họ và tên
                    </label>
                    <input
                      type="text"
                      required
                      value={editStdFullName}
                      onChange={(e) => setEditStdFullName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Tên đăng nhập
                    </label>
                    <input
                      type="text"
                      value={editStdUsername}
                      onChange={(e) => setEditStdUsername(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Trường học
                    </label>
                    <input
                      type="text"
                      value={editStdSchool}
                      onChange={(e) => setEditStdSchool(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Lớp hành chính
                    </label>
                    <input
                      type="text"
                      value={editStdClassName}
                      onChange={(e) => setEditStdClassName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Đặt lại mật khẩu mới (Để trống nếu giữ nguyên)
                    </label>
                    <input
                      type="password"
                      value={editStdPassword}
                      onChange={(e) => setEditStdPassword(e.target.value)}
                      placeholder="Tối thiểu 6 ký tự..."
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingStudent(null)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg"
                  >
                    Lưu cập nhật
                  </button>
                </div>
              </form>
            )}

            {/* Transfer Student Classroom Modal/Form */}
            {transferStudentTarget && (
              <form
                onSubmit={handleTransferStudentClass}
                className="p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-3"
              >
                <div className="text-xs font-bold text-slate-900">
                  Chuyển lớp cho học sinh: {transferStudentTarget.fullName}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Rút khỏi lớp hiện tại (Tùy chọn — Để trống nếu muốn giữ cả 2 lớp)
                    </label>
                    <select
                      value={transferFromClassId}
                      onChange={(e) => setTransferFromClassId(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="">-- Giữ lớp cũ, chỉ thêm vào lớp mới --</option>
                      {classrooms.map((c) => (
                        <option key={c.id} value={c.id}>
                          Rút khỏi: {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Chuyển đến lớp học đích *
                    </label>
                    <select
                      required
                      value={transferToClassId}
                      onChange={(e) => setTransferToClassId(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="">-- Chọn lớp đích --</option>
                      {classrooms.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setTransferStudentTarget(null)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg"
                  >
                    Xác nhận chuyển lớp
                  </button>
                </div>
              </form>
            )}

            {/* Students Table */}
            {loadingStudents ? (
              <div className="py-10 text-center text-xs text-slate-500">
                Đang tải danh sách học sinh...
              </div>
            ) : students.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                Không tìm thấy học sinh nào khớp với bộ lọc hiện tại.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                      <th className="py-2.5 px-3 font-semibold">Họ và tên</th>
                      <th className="py-2.5 px-3 font-semibold">Tên đăng nhập &amp; Email</th>
                      <th className="py-2.5 px-3 font-semibold">Lớp / Trường</th>
                      <th className="py-2.5 px-3 font-semibold">Trạng thái</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Thao tác quản lý</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {students.map((std) => (
                      <tr key={std.id} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          {std.fullName}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          <span className="font-mono text-slate-900">
                            @{std.username || '—'}
                          </span>
                          <span className="block text-[11px] text-slate-500">{std.email}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          <span className="font-semibold text-slate-800">
                            {std.className || 'Chưa cập nhật lớp'}
                          </span>
                          <span className="block text-[11px] text-slate-500">
                            {std.schoolName || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {std.isLocked ? (
                            <span className="text-red-700 font-semibold">Đang bị khóa</span>
                          ) : (
                            <span className="text-emerald-700 font-semibold">Hoạt động</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleInspectStudentAchievements(std.id)}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-amber-50 text-amber-800 hover:bg-amber-100 rounded inline-flex items-center gap-1"
                              title="Xem kết quả và lịch sử thi đấu"
                            >
                              <Award className="w-3.5 h-3.5" />
                              <span>Thành tích</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setTransferStudentTarget(std);
                                setTransferToClassId(classrooms[0]?.id || '');
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded inline-flex items-center gap-1"
                              title="Chuyển lớp học"
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                              <span>Chuyển lớp</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingStudent(std);
                                setEditStdFullName(std.fullName);
                                setEditStdUsername(std.username || '');
                                setEditStdSchool(std.schoolName || '');
                                setEditStdClassName(std.className || '');
                                setEditStdPassword('');
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded inline-flex items-center gap-1"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Sửa</span>
                            </button>

                            {confirmLockStudentId === std.id ? (
                              <div className="inline-flex items-center gap-1 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                                <span className="text-[11px] text-red-800 font-semibold">
                                  {std.isLocked ? 'Mở khóa?' : 'Khóa?'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleToggleStudentLock(std)}
                                  className="text-[11px] font-bold text-red-700 underline"
                                >
                                  Đồng ý
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmLockStudentId(null)}
                                  className="text-[11px] text-slate-500 ml-1"
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmLockStudentId(std.id)}
                                className={`px-2.5 py-1 text-[11px] font-semibold rounded inline-flex items-center gap-1 ${
                                  std.isLocked
                                    ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                              >
                                {std.isLocked ? (
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

            {/* Pagination */}
            {studentPagination && studentPagination.totalPages > 1 && (
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-mono tabular-nums">
                  Trang {studentPagination.page} / {studentPagination.totalPages} (Tổng:{' '}
                  {studentPagination.total} học sinh)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={studentPage <= 1}
                    onClick={() => setStudentPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded font-semibold"
                  >
                    Trước
                  </button>
                  <button
                    type="button"
                    disabled={studentPage >= studentPagination.totalPages}
                    onClick={() => setStudentPage((p) => p + 1)}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded font-semibold"
                  >
                    Tiếp
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Student Achievement & History Inspector Drawer/Card */}
          {(loadingAchievement || selectedAchievement) && (
            <div className="bg-white border border-slate-900 rounded-xl p-6 space-y-4">
              {loadingAchievement ? (
                <div className="py-6 text-center text-xs text-slate-500">
                  Đang tải hồ sơ thành tích học sinh...
                </div>
              ) : (
                selectedAchievement && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                      <div>
                        <div className="text-xs text-amber-700 font-semibold">
                          Hồ sơ Thành tích &amp; Lịch sử Thi đấu Cá nhân
                        </div>
                        <h4 className="text-lg font-bold text-slate-950">
                          {selectedAchievement.student.fullName} (@
                          {selectedAchievement.student.username || 'student'})
                        </h4>
                        <div className="text-xs text-slate-500">
                          {selectedAchievement.student.email} ·{' '}
                          {selectedAchievement.student.schoolName}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedAchievement(null)}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg"
                      >
                        Đóng bảng thành tích
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="text-xs text-slate-500">Tổng điểm tích lũy</div>
                        <div className="text-xl font-bold text-slate-950 font-mono tabular-nums">
                          {selectedAchievement.totalScore} điểm
                        </div>
                      </div>
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="text-xs text-slate-500">Số trận đã tham gia</div>
                        <div className="text-xl font-bold text-slate-950 font-mono tabular-nums">
                          {selectedAchievement.matchesPlayed} trận
                        </div>
                      </div>
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="text-xs text-slate-500">Tỉ lệ trả lời đúng</div>
                        <div className="text-xl font-bold text-emerald-700 font-mono tabular-nums">
                          {selectedAchievement.accuracyPercent}%
                        </div>
                      </div>
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="text-xs text-slate-500">Lớp đang theo học</div>
                        <div className="text-sm font-bold text-slate-900 mt-1">
                          {selectedAchievement.enrolledClassrooms.length > 0
                            ? selectedAchievement.enrolledClassrooms
                                .map((c) => `${c.name} (${c.code})`)
                                .join(', ')
                            : 'Chưa ghi danh lớp'}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h5 className="text-xs font-bold text-slate-700 mb-2">
                        Lịch sử thi đấu gần đây ({selectedAchievement.recentMatches.length})
                      </h5>
                      {selectedAchievement.recentMatches.length === 0 ? (
                        <div className="text-xs text-slate-500 py-4">
                          Học sinh này chưa có lượt thi đấu nào được ghi nhận.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-500">
                                <th className="py-2 px-3">Phòng thi</th>
                                <th className="py-2 px-3">Bộ đề</th>
                                <th className="py-2 px-3 text-right">Hạng</th>
                                <th className="py-2 px-3 text-right">Số câu đúng</th>
                                <th className="py-2 px-3 text-right">Điểm số</th>
                                <th className="py-2 px-3 text-right">Thời gian</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {selectedAchievement.recentMatches.map((m) => (
                                <tr key={m.id}>
                                  <td className="py-2 px-3 font-semibold text-slate-900">
                                    {m.roomTitle} (PIN: {m.roomCode})
                                  </td>
                                  <td className="py-2 px-3 text-slate-600">
                                    {m.questionSetTitle}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono tabular-nums">
                                    #{m.userRank || 1}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono tabular-nums">
                                    {m.userCorrectCount ?? 0}/{m.totalQuestions}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-950 tabular-nums">
                                    {m.userScore ?? 0}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono text-slate-500 tabular-nums">
                                    {new Date(m.finishedAt).toLocaleDateString('vi-VN')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* TEACHER SECTION: CSV / EXCEL BULK IMPORT WITH PREVIEW & VALIDATION */}
      {mode === 'TEACHER_AREA' && teacherSection === 'CSV_IMPORT' && canManageClasses && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="text-xs font-semibold text-amber-700 mb-0.5">
                Nhập dữ liệu hàng loạt (Bulk Import)
              </div>
              <h3 className="text-lg font-bold text-slate-950">
                Nhập danh sách Học sinh từ tệp CSV hoặc bảng tính Excel
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Hệ thống tự động kiểm tra định dạng, phát hiện bản ghi trùng lặp, báo lỗi từng dòng và cho phép xem trước danh sách trước khi xác nhận lưu vào CSDL.
              </p>
            </div>

            <label className="px-4 py-2 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer inline-flex items-center gap-1.5 shrink-0">
              <Upload className="w-3.5 h-3.5" />
              <span>Tải tệp .CSV lên</span>
              <input
                type="file"
                accept=".csv,.txt,.tsv"
                onChange={handleCsvFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Gán Mã lớp mặc định (Cho các dòng không điền cột Mã lớp)
                </label>
                <select
                  value={csvDefaultClassCode}
                  onChange={(e) => setCsvDefaultClassCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  <option value="">-- Lấy theo cột thứ 5 trong dữ liệu --</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.code}>
                      {c.name} (Mã lớp: {c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Dữ liệu CSV hoặc Sao chép trực tiếp từ Excel (Họ và tên, Email, Tên đăng nhập, Trường học, Mã lớp)
                </label>
                <textarea
                  rows={9}
                  value={csvRawText}
                  onChange={(e) => {
                    setCsvRawText(e.target.value);
                    setCsvImportResult(null);
                  }}
                  placeholder="Họ và tên,Email,Tên đăng nhập,Trường học,Mã lớp"
                  className="w-full p-3 text-xs font-mono border border-slate-300 rounded-lg leading-relaxed"
                />
              </div>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-950">
                  Bảng xem trước dữ liệu ({csvPreviewRows.length} dòng)
                </h4>
                <div className="text-xs text-slate-500 font-mono tabular-nums">
                  Hợp lệ: {csvPreviewRows.filter((r) => r.isValid).length} · Lỗi:{' '}
                  {csvPreviewRows.filter((r) => !r.isValid).length}
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <th className="py-2 px-3 font-semibold">Dòng</th>
                      <th className="py-2 px-3 font-semibold">Họ và tên</th>
                      <th className="py-2 px-3 font-semibold">Email</th>
                      <th className="py-2 px-3 font-semibold">Mã lớp</th>
                      <th className="py-2 px-3 font-semibold">Kiểm tra định dạng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {csvPreviewRows.map((row) => (
                      <tr
                        key={`${row.rowNumber}-${row.email}`}
                        className={row.isValid ? 'hover:bg-slate-50' : 'bg-red-50/60'}
                      >
                        <td className="py-2 px-3 font-mono text-slate-500 tabular-nums">
                          #{row.rowNumber}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-900">
                          {row.fullName || '—'}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-700">
                          {row.email || '—'}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900">
                          {row.classroomCode || '—'}
                        </td>
                        <td className="py-2 px-3">
                          {row.isValid ? (
                            <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Hợp lệ</span>
                            </span>
                          ) : (
                            <span className="text-red-700 font-semibold inline-flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>{row.validationMessage}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={importingCsv || csvPreviewRows.length === 0}
                  onClick={handleConfirmCsvImport}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {importingCsv
                    ? 'Đang xử lý nhập danh sách...'
                    : `Xác nhận nhập ${csvPreviewRows.length} dòng dữ liệu`}
                </button>
              </div>

              {csvImportResult && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div className="font-bold text-slate-950">
                    Kết quả xử lý từ máy chủ:
                  </div>
                  <div className="grid grid-cols-3 gap-2 font-mono">
                    <div>Tạo mới: {csvImportResult.importedCount} tài khoản</div>
                    <div>Ghi danh vào lớp: {csvImportResult.enrolledCount} lượt</div>
                    <div>Bỏ qua/Lỗi: {csvImportResult.skippedCount} dòng</div>
                  </div>
                  {csvImportResult.errors.length > 0 && (
                    <div className="pt-2 border-t border-slate-200 space-y-1 text-red-700">
                      <div className="font-semibold">Chi tiết lỗi từng dòng:</div>
                      {csvImportResult.errors.map((err, i) => (
                        <div key={i}>
                          • Dòng #{err.rowNumber} ({err.email}): {err.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CLASSROOMS & ROSTER SPLIT (Shown in STUDENT_AREA or TEACHER_AREA when CLASSROOMS tab is active) */}
      {(mode === 'STUDENT_AREA' || teacherSection === 'CLASSROOMS') && (
        <>
          {mode === 'TEACHER_AREA' && canManageClasses && (
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Chọn lớp học bên trái để quản lý sĩ số, thêm học sinh, chỉnh sửa thông tin hoặc khóa lớp.
              </div>
              <button
                type="button"
                onClick={() => setShowCreateClass(!showCreateClass)}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Tạo lớp học mới</span>
              </button>
            </div>
          )}

          {/* Create Classroom Modal/Form */}
          {showCreateClass && canManageClasses && (
            <form
              onSubmit={handleCreateClassroom}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            >
              <h3 className="text-base font-bold text-slate-950">
                Tạo lớp học mới (Tự động sinh Mã lớp hoặc tùy chỉnh)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên lớp học *
                  </label>
                  <input
                    type="text"
                    required
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="VD: Lớp 12A2 — Chuyên Lý"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Môn phụ trách *
                  </label>
                  <input
                    type="text"
                    required
                    value={classSubject}
                    onChange={(e) => setClassSubject(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Khối lớp *
                  </label>
                  <input
                    type="text"
                    required
                    value={classGrade}
                    onChange={(e) => setClassGrade(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mã lớp tùy chọn (Để trống tự sinh)
                  </label>
                  <input
                    type="text"
                    value={classCustomCode}
                    onChange={(e) => setClassCustomCode(e.target.value.toUpperCase())}
                    placeholder="VD: LY12A2"
                    className="w-full px-3.5 py-2 text-sm font-mono uppercase border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mô tả lớp học
                </label>
                <input
                  type="text"
                  value={classDesc}
                  onChange={(e) => setClassDesc(e.target.value)}
                  placeholder="Ghi chú lịch thi đấu hoặc mục tiêu học tập..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateClass(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg"
                >
                  Tạo lớp học
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-700 px-1">
                Danh sách lớp học ({classrooms.length})
              </h3>
              {classrooms.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
                  Chưa có lớp học nào.
                </div>
              ) : (
                classrooms.map((cls) => {
                  const isSelected = cls.id === selectedClassroomId;
                  return (
                    <div
                      key={cls.id}
                      onClick={() => {
                        setSelectedClassroomId(cls.id);
                        setEditingClass(false);
                      }}
                      className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-white border-slate-900 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span>
                          Mã lớp:{' '}
                          <strong className="font-mono text-slate-900">{cls.code}</strong>
                          {cls.isLocked ? ' · Đã khóa' : ' · Đang mở'}
                        </span>
                        <span className="tabular-nums">
                          {cls.studentCount} học sinh · {cls.activityCount ?? 0} hoạt động
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-950 mb-1">{cls.name}</h4>
                      <div className="text-xs text-slate-500">
                        {cls.subject} · {cls.gradeLevel} · GV: {cls.teacherName}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
              {!selectedClassroom ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  Chọn một lớp học để xem chi tiết và danh sách học sinh.
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
                        <span>Mã tham gia lớp:</span>
                        <span className="font-mono font-bold text-slate-950">
                          {selectedClassroom.code}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{selectedClassroom.subject}</span>
                        <span aria-hidden="true">·</span>
                        <span>{selectedClassroom.gradeLevel}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            selectedClassroom.isLocked
                              ? 'text-red-700 font-semibold'
                              : 'text-emerald-700 font-semibold'
                          }
                        >
                          {selectedClassroom.isLocked
                            ? 'Đang khóa ghi danh'
                            : 'Đang mở ghi danh'}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-950">
                        {selectedClassroom.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {selectedClassroom.description || 'Chưa có mô tả chi tiết.'} · Giáo viên phụ trách:{' '}
                        <strong>{selectedClassroom.teacherName}</strong>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(selectedClassroom.code);
                          setStatusMessage(
                            `Đã sao chép mã tham gia lớp: ${selectedClassroom.code}`
                          );
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Chia sẻ Mã ({selectedClassroom.code})</span>
                      </button>

                      {canManageClasses &&
                        (currentUser.role === 'ADMIN' ||
                          selectedClassroom.teacherId === currentUser.id) && (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingClass(!editingClass)}
                              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Sửa lớp</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRegenerateClassCode(selectedClassroom)}
                              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1"
                              title="Sinh mã tham gia mới"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Đổi mã</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleLockClassroom(selectedClassroom)}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1 ${
                                selectedClassroom.isLocked
                                  ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              {selectedClassroom.isLocked ? (
                                <>
                                  <Unlock className="w-3.5 h-3.5" />
                                  <span>Mở khóa lớp</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3.5 h-3.5" />
                                  <span>Khóa lớp</span>
                                </>
                              )}
                            </button>
                          </>
                        )}
                    </div>
                  </div>

                  {/* Inline Edit Classroom Form */}
                  {editingClass && canManageClasses && (
                    <form
                      onSubmit={handleSaveClassroomEdit}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
                    >
                      <div className="text-xs font-bold text-slate-900">
                        Chỉnh sửa thông tin lớp học
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Tên lớp học
                          </label>
                          <input
                            type="text"
                            required
                            value={editClassName}
                            onChange={(e) => setEditClassName(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Môn học
                          </label>
                          <input
                            type="text"
                            required
                            value={editClassSubject}
                            onChange={(e) => setEditClassSubject(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Khối lớp
                          </label>
                          <input
                            type="text"
                            required
                            value={editClassGrade}
                            onChange={(e) => setEditClassGrade(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Mô tả lớp học
                        </label>
                        <input
                          type="text"
                          value={editClassDesc}
                          onChange={(e) => setEditClassDesc(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingClass(false)}
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

                  {/* Add Student by Email/Username directly to Class */}
                  {canManageClasses &&
                    (currentUser.role === 'ADMIN' ||
                      selectedClassroom.teacherId === currentUser.id) && (
                      <form
                        onSubmit={handleAddStudentToClassByIdentifier}
                        className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl"
                      >
                        <input
                          type="text"
                          required
                          value={addStudentIdentifier}
                          onChange={(e) => setAddStudentIdentifier(e.target.value)}
                          placeholder="Thêm học sinh vào lớp bằng Email hoặc Tên đăng nhập..."
                          className="flex-1 min-w-[220px] px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                        <button
                          type="submit"
                          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 shrink-0"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Thêm vào lớp</span>
                        </button>
                      </form>
                    )}

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-slate-700" />
                        <span>Danh sách học sinh trong lớp ({members.length})</span>
                      </h4>
                    </div>

                    {loadingMembers ? (
                      <div className="py-8 text-center text-xs text-slate-500">
                        Đang tải danh sách học sinh...
                      </div>
                    ) : members.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500">
                        Chưa có học sinh nào ghi danh. Học sinh có thể nhập mã{' '}
                        <strong className="font-mono">{selectedClassroom.code}</strong> để tham gia.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-xs text-slate-500">
                              <th className="py-2.5 px-3 font-semibold">Họ và tên</th>
                              <th className="py-2.5 px-3 font-semibold">Email / Tài khoản</th>
                              <th className="py-2.5 px-3 font-semibold">Ngày tham gia</th>
                              {canManageClasses && (
                                <th className="py-2.5 px-3 font-semibold text-right">
                                  Thao tác
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-sm">
                            {members.map((m) => (
                              <tr key={m.id} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 font-semibold text-slate-900">
                                  {m.studentName}
                                </td>
                                <td className="py-2.5 px-3 text-xs text-slate-600">
                                  {m.studentEmail}
                                  {m.studentUsername && (
                                    <span className="font-mono text-slate-400 ml-1">
                                      (@{m.studentUsername})
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-xs font-mono text-slate-500 tabular-nums">
                                  {new Date(m.joinedAt).toLocaleDateString('vi-VN')}
                                </td>
                                {canManageClasses && (
                                  <td className="py-2.5 px-3 text-right">
                                    {confirmRemoveStudentId === m.studentId ? (
                                      <div className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 px-2 py-0.5 rounded text-xs">
                                        <span className="text-red-800 font-semibold">
                                          Xóa khỏi lớp?
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveMember(m.studentId)}
                                          className="text-red-700 font-bold underline"
                                        >
                                          Xác nhận
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setConfirmRemoveStudentId(null)}
                                          className="text-slate-500"
                                        >
                                          Hủy
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setConfirmRemoveStudentId(m.studentId)}
                                        className="p-1 text-slate-400 hover:text-red-600 rounded"
                                        title="Xóa khỏi lớp"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
