import React, { useEffect, useState } from 'react';
import {
  Plus,
  Play,
  Trash2,
  BookOpen,
  CheckCircle2,
  Lock,
  Image as ImageIcon,
  Sparkles,
  FileSpreadsheet,
  FileText,
  Download,
  Upload,
  Copy,
  Edit3,
  Eye,
  ArrowUp,
  ArrowDown,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Filter,
  Share2,
  FolderTree,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/apiClient.ts';
import type {
  AiProviderStatus,
  CognitiveLevel,
  DifficultyLevel,
  FullQuestion,
  GeneratedDraftQuestion,
  MatchingPairItem,
  PublicQuestion,
  QuestionCategory,
  QuestionQualityIssue,
  QuestionSet,
  QuestionType,
  QuestionUsageStatus,
  UserProfile,
} from '../types/arena.ts';

interface QuestionBankViewProps {
  currentUser: UserProfile;
  questionSets: QuestionSet[];
  onRefreshSets: () => Promise<void>;
  onLaunchRoomFromSet: (questionSetId: string, isTestMode: boolean) => Promise<void>;
}

type BankSubTab =
  | 'EXPLORER'
  | 'EDITOR'
  | 'MATRIX_BUILDER'
  | 'AI_STUDIO'
  | 'IMPORT_EXPORT'
  | 'QUALITY_CATEGORIES';

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;

const QUESTION_TYPE_LABELS: Record<QuestionType, { label: string; arenaSupported: boolean }> = {
  SINGLE_CHOICE: { label: 'Trắc nghiệm 1 đáp án', arenaSupported: true },
  MULTIPLE_CHOICE: { label: 'Trắc nghiệm nhiều đáp án', arenaSupported: true },
  TRUE_FALSE: { label: 'Đúng hoặc Sai', arenaSupported: true },
  FILL_IN_BLANK: { label: 'Điền từ còn thiếu', arenaSupported: false },
  SHORT_ANSWER: { label: 'Trả lời ngắn', arenaSupported: false },
  MATCHING: { label: 'Ghép đôi', arenaSupported: false },
  ORDERING: { label: 'Sắp xếp thứ tự', arenaSupported: false },
  IMAGE_CHOICE: { label: 'Chọn hình ảnh đúng', arenaSupported: true },
  IMAGE_RECOGNITION: { label: 'Nhận diện hình ảnh', arenaSupported: true },
  AUDIO_QUESTION: { label: 'Câu hỏi có âm thanh', arenaSupported: true },
  VIDEO_QUESTION: { label: 'Câu hỏi có video', arenaSupported: true },
  ESSAY: { label: 'Tự luận (Giáo viên chấm)', arenaSupported: false },
};

const COGNITIVE_LABELS: Record<CognitiveLevel, string> = {
  REMEMBER: 'Nhận biết',
  UNDERSTAND: 'Thông hiểu',
  APPLY: 'Vận dụng',
  HIGH_APPLY: 'Vận dụng cao',
};

const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  EASY: 'Dễ',
  MEDIUM: 'Trung bình',
  HARD: 'Khó',
  VERY_HARD: 'Rất khó',
};

const STATUS_LABELS: Record<QuestionUsageStatus, string> = {
  ACTIVE: 'Đang sử dụng',
  DRAFT: 'Bản nháp',
  ARCHIVED: 'Lưu trữ',
};

function triggerBase64Download(fileName: string, mimeType: string, base64Data: string) {
  const byteChars = atob(base64Data);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const QuestionBankView: React.FC<QuestionBankViewProps> = ({
  currentUser,
  questionSets,
  onRefreshSets,
  onLaunchRoomFromSet,
}) => {
  const canEdit = currentUser.role === 'ADMIN' || currentUser.role === 'TEACHER';

  const [activeTab, setActiveTab] = useState<BankSubTab>('EXPLORER');
  const [selectedSetId, setSelectedSetId] = useState<string>(questionSets[0]?.id || '');
  const [questions, setQuestions] = useState<Array<FullQuestion | PublicQuestion>>([]);
  const [answersMasked, setAnswersMasked] = useState<boolean>(false);
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(false);

  // Filters in Explorer
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterCognitive, setFilterCognitive] = useState<string>('ALL');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('ALL');
  const [filterArenaOnly, setFilterArenaOnly] = useState<boolean>(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [previewQuestion, setPreviewQuestion] = useState<FullQuestion | PublicQuestion | null>(
    null
  );

  // Create / Edit Question Set Form
  const [showCreateSet, setShowCreateSet] = useState(false);
  const [newSetTitle, setNewSetTitle] = useState('');
  const [newSetSubject, setNewSetSubject] = useState('Toán học');
  const [newSetGrade, setNewSetGrade] = useState('Khối 12');
  const [newSetEducationLevel, setNewSetEducationLevel] = useState('THPT');
  const [newSetTopic, setNewSetTopic] = useState('');
  const [newSetDesc, setNewSetDesc] = useState('');
  const [newSetDefaultTime, setNewSetDefaultTime] = useState(20);
  const [newSetDefaultPoints, setNewSetDefaultPoints] = useState(1000);
  const [newSetIsPublic, setNewSetIsPublic] = useState(true);

  // Share Modal State
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [shareTeacherIdInput, setShareTeacherIdInput] = useState('');

  // Question Editor State (Create or Edit 12 types + 20 fields)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [qType, setQType] = useState<QuestionType>('SINGLE_CHOICE');
  const [qPrompt, setQPrompt] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [qCorrectIndex, setQCorrectIndex] = useState(0);
  const [qCorrectIndices, setQCorrectIndices] = useState<number[]>([0, 1]);
  const [qCorrectAnswerText, setQCorrectAnswerText] = useState('');
  const [qMatchingPairs, setQMatchingPairs] = useState<MatchingPairItem[]>([
    { left: '', right: '' },
    { left: '', right: '' },
  ]);
  const [qOrderingItems, setQOrderingItems] = useState<string[]>(['', '', '']);
  const [qEducationLevel, setQEducationLevel] = useState('THPT');
  const [qGradeLevel, setQGradeLevel] = useState('Khối 12');
  const [qSubject, setQSubject] = useState('Toán học');
  const [qTopic, setQTopic] = useState('Chuyên đề trọng tâm');
  const [qLesson, setQLesson] = useState('');
  const [qCognitive, setQCognitive] = useState<CognitiveLevel>('UNDERSTAND');
  const [qDifficulty, setQDifficulty] = useState<DifficultyLevel>('MEDIUM');
  const [qUsageStatus, setQUsageStatus] = useState<QuestionUsageStatus>('ACTIVE');
  const [qTimeSec, setQTimeSec] = useState(20);
  const [qPoints, setQPoints] = useState(1000);
  const [qExplanation, setQExplanation] = useState('');
  const [qImageUrl, setQImageUrl] = useState('');
  const [qAudioUrl, setQAudioUrl] = useState('');
  const [qVideoUrl, setQVideoUrl] = useState('');

  // Matrix Builder State (Section V)
  const [matrixRemember, setMatrixRemember] = useState(3);
  const [matrixUnderstand, setMatrixUnderstand] = useState(3);
  const [matrixApply, setMatrixApply] = useState(2);
  const [matrixHighApply, setMatrixHighApply] = useState(1);
  const [matrixArenaOnly, setMatrixArenaOnly] = useState(true);
  const [matrixPreviewQuestions, setMatrixPreviewQuestions] = useState<FullQuestion[]>([]);
  const [loadingMatrix, setLoadingMatrix] = useState(false);

  // AI Studio State (Sections VIII, IX, X, XII)
  const [aiStatus, setAiStatus] = useState<AiProviderStatus | null>(null);
  const [aiMode, setAiMode] = useState<'PROMPT' | 'DOCUMENT' | 'IMAGE'>('PROMPT');
  const [aiSubject, setAiSubject] = useState('Vật lý');
  const [aiGrade, setAiGrade] = useState('Khối 12');
  const [aiTopic, setAiTopic] = useState('Dao động điều hòa và con lắc lò xo');
  const [aiLesson, setAiLesson] = useState('');
  const [aiQType, setAiQType] = useState<QuestionType>('SINGLE_CHOICE');
  const [aiCognitive, setAiCognitive] = useState<CognitiveLevel>('UNDERSTAND');
  const [aiDifficulty, setAiDifficulty] = useState<DifficultyLevel>('MEDIUM');
  const [aiCount, setAiCount] = useState(4);
  const [aiInstructions, setAiInstructions] = useState('');
  const [aiDocText, setAiDocText] = useState('');
  const [aiDocFileName, setAiDocFileName] = useState('');
  const [aiDocBase64, setAiDocBase64] = useState('');
  const [aiImageMime, setAiImageMime] = useState('image/png');
  const [aiImageBase64, setAiImageBase64] = useState('');
  const [aiImageFileName, setAiImageFileName] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [aiKeyPoints, setAiKeyPoints] = useState<string[]>([]);
  const [aiDrafts, setAiDrafts] = useState<GeneratedDraftQuestion[]>([]);

  // Import & Export State (Sections VI, VII)
  const [importPreview, setImportPreview] = useState<{
    fileName: string;
    format: 'XLSX' | 'CSV' | 'DOCX';
    totalRows: number;
    validCount: number;
    errorCount: number;
    duplicateCount: number;
    detectedColumns: string[];
    rows: any[];
  } | null>(null);
  const [importSkipDuplicates, setImportSkipDuplicates] = useState(true);
  const [importSkipInvalid, setImportSkipInvalid] = useState(true);
  const [importLoading, setImportLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState<'XLSX' | 'CSV' | 'DOCX' | 'JSON'>('XLSX');
  const [exportIncludeAnswers, setExportIncludeAnswers] = useState(true);
  const [exportScope, setExportScope] = useState<'CURRENT_SET' | 'SELECTED' | 'ALL_BANK'>(
    'CURRENT_SET'
  );

  // Quality Check & Categories State (Sections IV, XI)
  const [qualityIssues, setQualityIssues] = useState<QuestionQualityIssue[]>([]);
  const [loadingQuality, setLoadingQuality] = useState(false);
  const [categories, setCategories] = useState<QuestionCategory[]>([]);
  const [catName, setCatName] = useState('');
  const [catEduLevel, setCatEduLevel] = useState('THPT');
  const [catGrade, setCatGrade] = useState('Khối 12');
  const [catSubject, setCatSubject] = useState('Toán học');
  const [catTopic, setCatTopic] = useState('');
  const [catLesson, setCatLesson] = useState('');

  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedSetId && questionSets.length > 0) {
      setSelectedSetId(questionSets[0].id);
    }
  }, [questionSets, selectedSetId]);

  const loadQuestions = async (setId: string) => {
    if (!setId) return;
    setLoadingQuestions(true);
    setErrorMsg(null);
    try {
      const res = await api.getQuestionsForSet(setId);
      setQuestions(res.questions);
      setAnswersMasked(res.answersMasked);
      setSelectedQuestionIds([]);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể tải danh sách câu hỏi.');
    } finally {
      setLoadingQuestions(false);
    }
  };

  useEffect(() => {
    if (selectedSetId) {
      loadQuestions(selectedSetId);
    }
  }, [selectedSetId]);

  useEffect(() => {
    if (!canEdit) return;
    api
      .getAiStatus()
      .then((res) => setAiStatus(res.status))
      .catch(() => {});
    api
      .listCategories()
      .then((res) => setCategories(res.categories))
      .catch(() => {});
  }, [canEdit]);

  const activeSet = questionSets.find((s) => s.id === selectedSetId) || null;

  // Sync default subject/grade when switching set
  useEffect(() => {
    if (activeSet && !editingQuestionId) {
      setQSubject(activeSet.subject || 'Toán học');
      setQGradeLevel(activeSet.gradeLevel || 'Khối 12');
      setQEducationLevel(activeSet.educationLevel || 'THPT');
      if (activeSet.topic) setQTopic(activeSet.topic);
      if (activeSet.defaultTimeLimitSec) setQTimeSec(activeSet.defaultTimeLimitSec);
      if (activeSet.defaultPoints) setQPoints(activeSet.defaultPoints);
    }
  }, [activeSet, editingQuestionId]);

  const resetQuestionEditor = () => {
    setEditingQuestionId(null);
    setQType('SINGLE_CHOICE');
    setQPrompt('');
    setOptA('');
    setOptB('');
    setOptC('');
    setOptD('');
    setQCorrectIndex(0);
    setQCorrectIndices([0, 1]);
    setQCorrectAnswerText('');
    setQMatchingPairs([
      { left: '', right: '' },
      { left: '', right: '' },
    ]);
    setQOrderingItems(['', '', '']);
    setQExplanation('');
    setQImageUrl('');
    setQAudioUrl('');
    setQVideoUrl('');
    setQUsageStatus('ACTIVE');
  };

  const openEditQuestion = (q: FullQuestion) => {
    setEditingQuestionId(q.id);
    setQType(q.questionType || 'SINGLE_CHOICE');
    setQPrompt(q.prompt || '');
    setOptA(q.options?.[0] || '');
    setOptB(q.options?.[1] || '');
    setOptC(q.options?.[2] || '');
    setOptD(q.options?.[3] || '');
    setQCorrectIndex(q.correctIndex ?? 0);
    setQCorrectIndices(q.correctIndices?.length ? q.correctIndices : [q.correctIndex ?? 0]);
    setQCorrectAnswerText(q.correctAnswerText || '');
    setQMatchingPairs(
      q.matchingPairs?.length
        ? q.matchingPairs
        : [
            { left: '', right: '' },
            { left: '', right: '' },
          ]
    );
    setQOrderingItems(q.orderingItems?.length ? q.orderingItems : ['', '', '']);
    setQEducationLevel(q.educationLevel || 'THPT');
    setQGradeLevel(q.gradeLevel || 'Khối 12');
    setQSubject(q.subject || 'Tổng hợp');
    setQTopic(q.topic || 'Chuyên đề chung');
    setQLesson(q.lesson || '');
    setQCognitive(q.cognitiveLevel || 'UNDERSTAND');
    setQDifficulty(q.difficulty || 'MEDIUM');
    setQUsageStatus(q.usageStatus || 'ACTIVE');
    setQTimeSec(q.timeLimitSec || 20);
    setQPoints(q.points || 1000);
    setQExplanation(q.explanation || '');
    setQImageUrl(q.imageUrl || '');
    setQAudioUrl(q.audioUrl || '');
    setQVideoUrl(q.videoUrl || '');
    setActiveTab('EDITOR');
  };

  const handleCreateSet = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      const res = await api.createQuestionSet({
        title: newSetTitle,
        subject: newSetSubject,
        gradeLevel: newSetGrade,
        educationLevel: newSetEducationLevel,
        topic: newSetTopic,
        description: newSetDesc,
        isPublic: newSetIsPublic,
        defaultTimeLimitSec: newSetDefaultTime,
        defaultPoints: newSetDefaultPoints,
      });
      await onRefreshSets();
      setSelectedSetId(res.questionSet.id);
      setShowCreateSet(false);
      setNewSetTitle('');
      setNewSetDesc('');
      setFeedbackMsg(`Đã tạo bộ câu hỏi "${res.questionSet.title}".`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể tạo bộ câu hỏi.');
    }
  };

  const handleDuplicateSet = async (setId: string) => {
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      const res = await api.duplicateQuestionSet(setId);
      await onRefreshSets();
      setSelectedSetId(res.questionSet.id);
      setFeedbackMsg(`Đã nhân bản bộ đề thành "${res.questionSet.title}".`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể nhân bản bộ đề.');
    }
  };

  const handleToggleShareSet = async (isPublic: boolean) => {
    if (!activeSet) return;
    setErrorMsg(null);
    try {
      const sharedWithIds = shareTeacherIdInput.trim()
        ? Array.from(new Set([...(activeSet.sharedWithIds || []), shareTeacherIdInput.trim()]))
        : activeSet.sharedWithIds || [];
      await api.updateQuestionSet(activeSet.id, {
        isPublic,
        sharedWithIds,
      });
      setShareTeacherIdInput('');
      await onRefreshSets();
      setFeedbackMsg('Đã cập nhật quyền chia sẻ bộ câu hỏi.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể cập nhật quyền chia sẻ.');
    }
  };

  const handleDeleteSet = async (id: string) => {
    setErrorMsg(null);
    try {
      await api.deleteQuestionSet(id);
      await onRefreshSets();
      const remaining = questionSets.filter((s) => s.id !== id);
      setSelectedSetId(remaining[0]?.id || '');
      setFeedbackMsg('Đã xóa bộ câu hỏi.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể xóa bộ câu hỏi.');
    }
  };

  const handleToggleMultiCorrect = (idx: number) => {
    setQCorrectIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx].sort((a, b) => a - b)
    );
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSetId) {
      setErrorMsg('Vui lòng chọn bộ đề đích trước khi lưu câu hỏi.');
      return;
    }
    setErrorMsg(null);
    setFeedbackMsg(null);

    try {
      let optionsPayload: string[] = [];
      if (qType === 'TRUE_FALSE') {
        optionsPayload = ['Đúng', 'Sai'];
      } else if (qType === 'ORDERING') {
        optionsPayload = qOrderingItems.map((i) => i.trim()).filter(Boolean);
      } else if (
        qType === 'SINGLE_CHOICE' ||
        qType === 'MULTIPLE_CHOICE' ||
        qType === 'IMAGE_CHOICE' ||
        qType === 'IMAGE_RECOGNITION' ||
        qType === 'AUDIO_QUESTION' ||
        qType === 'VIDEO_QUESTION'
      ) {
        optionsPayload = [optA, optB, optC, optD].map((o) => o.trim()).filter(Boolean);
      }

      const correctIndicesPayload =
        qType === 'MULTIPLE_CHOICE'
          ? qCorrectIndices.length > 0
            ? qCorrectIndices
            : [0]
          : [qCorrectIndex];

      const payload = {
        questionType: qType,
        prompt: qPrompt,
        options: optionsPayload,
        correctIndex: correctIndicesPayload[0],
        correctIndices: correctIndicesPayload,
        correctAnswerText: qCorrectAnswerText,
        matchingPairs: qMatchingPairs.filter((p) => p.left.trim() && p.right.trim()),
        orderingItems: qOrderingItems.map((i) => i.trim()).filter(Boolean),
        educationLevel: qEducationLevel,
        gradeLevel: qGradeLevel,
        subject: qSubject,
        topic: qTopic,
        lesson: qLesson,
        cognitiveLevel: qCognitive,
        difficulty: qDifficulty,
        usageStatus: qUsageStatus,
        timeLimitSec: qTimeSec,
        points: qPoints,
        explanation: qExplanation,
        imageUrl: qImageUrl.trim() || undefined,
        audioUrl: qAudioUrl.trim() || undefined,
        videoUrl: qVideoUrl.trim() || undefined,
      };

      if (editingQuestionId) {
        await api.updateQuestion(editingQuestionId, payload);
        setFeedbackMsg('Đã cập nhật câu hỏi thành công.');
      } else {
        await api.addQuestionToSet(selectedSetId, payload);
        setFeedbackMsg('Đã thêm câu hỏi mới vào ngân hàng.');
      }

      await loadQuestions(selectedSetId);
      await onRefreshSets();
      resetQuestionEditor();
      setActiveTab('EXPLORER');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể lưu câu hỏi.');
    }
  };

  const handleDuplicateQuestion = async (questionId: string) => {
    setErrorMsg(null);
    try {
      await api.duplicateQuestion(questionId, selectedSetId);
      await loadQuestions(selectedSetId);
      await onRefreshSets();
      setFeedbackMsg('Đã tạo bản sao câu hỏi.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể sao chép câu hỏi.');
    }
  };

  const handleRemoveQuestionFromSetOnly = async (questionId: string) => {
    if (!selectedSetId) return;
    setErrorMsg(null);
    try {
      await api.removeQuestionFromSet(selectedSetId, questionId);
      await loadQuestions(selectedSetId);
      await onRefreshSets();
      setFeedbackMsg('Đã gỡ câu hỏi khỏi bộ đề (câu hỏi gốc vẫn được bảo toàn trong kho lưu trữ).');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể gỡ câu hỏi khỏi bộ đề.');
    }
  };

  const handleDeleteQuestionPermanently = async (questionId: string) => {
    setErrorMsg(null);
    try {
      await api.deleteQuestion(questionId);
      await loadQuestions(selectedSetId);
      await onRefreshSets();
      setFeedbackMsg('Đã xóa vĩnh viễn câu hỏi khỏi ngân hàng.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể xóa câu hỏi.');
    }
  };

  const handleMoveQuestionOrder = async (index: number, direction: 'UP' | 'DOWN') => {
    if (!selectedSetId) return;
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= questions.length) return;
    const ordered = [...questions];
    const [moved] = ordered.splice(index, 1);
    ordered.splice(targetIdx, 0, moved);
    setQuestions(ordered);
    try {
      await api.reorderQuestionsInSet(
        selectedSetId,
        ordered.map((q) => q.id)
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể sắp xếp thứ tự câu hỏi.');
    }
  };

  // Matrix Auto-Selection (Section V)
  const handlePreviewOrApplyMatrix = async (applyToSet: boolean) => {
    if (!selectedSetId) return;
    setLoadingMatrix(true);
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      const res = await api.autoSelectMatrixForSet(selectedSetId, {
        subject: activeSet?.subject,
        arenaOnly: matrixArenaOnly,
        cognitiveCounts: {
          REMEMBER: matrixRemember,
          UNDERSTAND: matrixUnderstand,
          APPLY: matrixApply,
          HIGH_APPLY: matrixHighApply,
        },
        applyToSet,
      });
      setMatrixPreviewQuestions(res.previewQuestions);
      if (applyToSet) {
        await loadQuestions(selectedSetId);
        await onRefreshSets();
        setFeedbackMsg(
          `Đã tự động rút trích và đưa ${res.addedCount} câu hỏi theo ma trận vào bộ đề "${activeSet?.title}".`
        );
      } else {
        setFeedbackMsg(
          `Đã tìm thấy ${res.totalSelected} câu hỏi phù hợp với cấu hình ma trận đề.`
        );
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể tạo đề theo ma trận.');
    } finally {
      setLoadingMatrix(false);
    }
  };

  // AI Question Generation Handlers (Sections VIII, IX, X)
  const handleRunAiGenerator = async () => {
    setAiLoading(true);
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      if (aiMode === 'PROMPT') {
        const res = await api.generateQuestionsByPrompt({
          subject: aiSubject,
          gradeLevel: aiGrade,
          topic: aiTopic,
          lesson: aiLesson,
          questionType: aiQType,
          cognitiveLevel: aiCognitive,
          difficulty: aiDifficulty,
          count: aiCount,
          additionalInstructions: aiInstructions,
        });
        setAiDrafts(res.questions);
        setAiSummary(res.summary);
        setAiKeyPoints([]);
      } else if (aiMode === 'DOCUMENT') {
        const res = await api.generateQuestionsFromDocument({
          fileName: aiDocFileName || 'Tai_lieu_hoc_tap.txt',
          fileBase64: aiDocBase64 || undefined,
          rawText: aiDocText || undefined,
          subject: aiSubject,
          gradeLevel: aiGrade,
          topic: aiTopic,
          questionType: aiQType,
          cognitiveLevel: aiCognitive,
          difficulty: aiDifficulty,
          count: aiCount,
        });
        setAiDrafts(res.questions);
        setAiKeyPoints(res.extractedKeyPoints || []);
        setAiSummary(
          res.warning ||
            `Đã phân tích tài liệu (${res.documentLength} ký tự) và đề xuất ${res.questions.length} câu hỏi.`
        );
      } else {
        const res = await api.generateQuestionsFromImage({
          mimeType: aiImageMime,
          imageBase64: aiImageBase64,
          subject: aiSubject,
          gradeLevel: aiGrade,
          topic: aiTopic,
          count: aiCount,
          teacherPrompt: aiInstructions,
        });
        setAiDrafts(res.questions);
        setAiSummary(res.imageAnalysisSummary);
        setAiKeyPoints([]);
      }
      const statusRes = await api.getAiStatus().catch(() => null);
      if (statusRes) setAiStatus(statusRes.status);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể sinh câu hỏi tự động.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveAiDraftToBank = async (draft: GeneratedDraftQuestion, idx: number) => {
    if (!selectedSetId) {
      setErrorMsg('Vui lòng chọn bộ đề đích ở cột bên trái trước khi duyệt lưu câu hỏi.');
      return;
    }
    setErrorMsg(null);
    try {
      await api.addQuestionToSet(selectedSetId, {
        questionType: draft.questionType,
        prompt: draft.prompt,
        options: draft.options,
        correctIndex: draft.correctIndex,
        correctIndices: draft.correctIndices,
        correctAnswerText: draft.correctAnswerText,
        matchingPairs: draft.matchingPairs,
        orderingItems: draft.orderingItems,
        educationLevel: draft.educationLevel,
        gradeLevel: draft.gradeLevel,
        subject: draft.subject,
        topic: draft.topic,
        lesson: draft.lesson,
        cognitiveLevel: draft.cognitiveLevel,
        difficulty: draft.difficulty,
        timeLimitSec: draft.timeLimitSec || 20,
        points: draft.points || 1000,
        explanation: draft.explanation,
      });
      setAiDrafts((prev) => prev.filter((_, i) => i !== idx));
      await loadQuestions(selectedSetId);
      await onRefreshSets();
      setFeedbackMsg(`Đã duyệt và lưu câu hỏi vào bộ đề "${activeSet?.title}".`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể lưu câu hỏi từ bản nháp AI.');
    }
  };

  const handleSaveAllAiDrafts = async () => {
    if (!selectedSetId || aiDrafts.length === 0) return;
    setErrorMsg(null);
    try {
      const res = await api.commitQuestionsImport({
        questionSetId: selectedSetId,
        rows: aiDrafts,
        skipDuplicates: false,
        skipInvalid: true,
      });
      setAiDrafts([]);
      await loadQuestions(selectedSetId);
      await onRefreshSets();
      setFeedbackMsg(`Đã lưu toàn bộ ${res.importedCount} câu hỏi AI vào bộ đề "${activeSet?.title}".`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể lưu hàng loạt câu hỏi AI.');
    }
  };

  // File Upload Readers for AI Document, AI Image, and Bulk Import
  const handleAiDocFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAiDocFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = String(reader.result || '');
      setAiDocBase64(b64);
    };
    reader.readAsDataURL(file);
  };

  const handleAiImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAiImageFileName(file.name);
    setAiImageMime(file.type || 'image/png');
    const reader = new FileReader();
    reader.onload = () => {
      setAiImageBase64(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setErrorMsg(null);
    setFeedbackMsg(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await api.previewQuestionsImport({
          fileName: file.name,
          fileBase64: String(reader.result || ''),
          questionSetId: selectedSetId || undefined,
          defaultSubject: activeSet?.subject || 'Tổng hợp',
          defaultGradeLevel: activeSet?.gradeLevel || 'Khối 12',
        });
        setImportPreview(res.preview);
      } catch (err: any) {
        setErrorMsg(err?.message || 'Không thể phân tích tệp tải lên.');
      } finally {
        setImportLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCommitImport = async () => {
    if (!importPreview || !selectedSetId) return;
    setImportLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.commitQuestionsImport({
        questionSetId: selectedSetId,
        rows: importPreview.rows,
        skipDuplicates: importSkipDuplicates,
        skipInvalid: importSkipInvalid,
      });
      setImportPreview(null);
      await loadQuestions(selectedSetId);
      await onRefreshSets();
      setFeedbackMsg(
        `Nhập dữ liệu hoàn tất: Đã lưu ${res.importedCount} câu hỏi (Bỏ qua ${res.skippedInvalidCount} dòng lỗi, ${res.skippedDuplicateCount} dòng trùng).`
      );
      setActiveTab('EXPLORER');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể lưu dữ liệu nhập khẩu.');
    } finally {
      setImportLoading(false);
    }
  };

  const handleDownloadTemplate = async (format: 'XLSX' | 'CSV') => {
    try {
      const tpl = await api.getImportTemplate(format);
      triggerBase64Download(tpl.fileName, tpl.mimeType, tpl.contentBase64);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể tải tệp mẫu.');
    }
  };

  const handleExportQuestions = async () => {
    setErrorMsg(null);
    try {
      const payload: {
        questionSetId?: string;
        questionIds?: string[];
        format: 'XLSX' | 'CSV' | 'DOCX' | 'JSON';
        includeAnswers: boolean;
      } = {
        format: exportFormat,
        includeAnswers: exportIncludeAnswers,
      };
      if (exportScope === 'SELECTED') {
        if (selectedQuestionIds.length === 0) {
          setErrorMsg('Vui lòng tích chọn ít nhất 1 câu hỏi trong danh sách để xuất.');
          return;
        }
        payload.questionIds = selectedQuestionIds;
      } else if (exportScope === 'CURRENT_SET') {
        payload.questionSetId = selectedSetId;
      }

      const res = await api.exportQuestions(payload);
      if (res.exportResult.contentBase64) {
        triggerBase64Download(
          res.exportResult.fileName,
          res.exportResult.mimeType,
          res.exportResult.contentBase64
        );
        setFeedbackMsg(
          `Đã xuất ${res.exportResult.questionCount} câu hỏi ra tệp ${res.exportResult.fileName}.`
        );
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể xuất tệp câu hỏi.');
    }
  };

  const handleRunQualityCheck = async (scopeSetId?: string) => {
    setLoadingQuality(true);
    setErrorMsg(null);
    try {
      const res = await api.runQualityCheck(scopeSetId);
      setQualityIssues(res.issues);
      setFeedbackMsg(
        `Đã rà soát chất lượng ngân hàng câu hỏi: Phát hiện ${res.errorCount} lỗi nghiêm trọng và ${res.warningCount} cảnh báo sư phạm.`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể chạy kiểm tra chất lượng.');
    } finally {
      setLoadingQuality(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const res = await api.createCategory({
        name: catName,
        educationLevel: catEduLevel,
        gradeLevel: catGrade,
        subject: catSubject,
        topic: catTopic || catName,
        lesson: catLesson,
      });
      setCategories((prev) => [res.category, ...prev]);
      setCatName('');
      setCatTopic('');
      setCatLesson('');
      setFeedbackMsg(`Đã thêm danh mục phân loại "${res.category.name}".`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể tạo danh mục.');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await api.deleteCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể xóa danh mục.');
    }
  };

  const subjects = ['ALL', ...Array.from(new Set(questionSets.map((s) => s.subject)))];
  const filteredSets =
    subjectFilter === 'ALL'
      ? questionSets
      : questionSets.filter((s) => s.subject === subjectFilter);

  const displayedQuestions = questions.filter((q) => {
    if (filterType !== 'ALL' && q.questionType !== filterType) return false;
    if (filterCognitive !== 'ALL' && q.cognitiveLevel !== filterCognitive) return false;
    if (filterDifficulty !== 'ALL' && q.difficulty !== filterDifficulty) return false;
    if (filterArenaOnly && q.isArenaSupported === false) return false;
    if (searchQuery.trim()) {
      const needle = searchQuery.trim().toLowerCase();
      const hay = `${q.questionCode || ''} ${q.prompt} ${q.topic || ''} ${q.subject || ''}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-Navigation Workspace Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">
              Ngân hàng câu hỏi thông minh & Trợ lý AI
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Hỗ trợ 12 dạng câu hỏi, phân loại 7 cấp độ nhận thức, rút đề theo ma trận, nhập/xuất Word · Excel · CSV và biên soạn cùng AI.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={() => setShowCreateSet(!showCreateSet)}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Tạo bộ đề mới</span>
              </button>
            )}
          </div>
        </div>

        {/* 6 Functional Sub-Tabs */}
        {canEdit && (
          <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100">
            {(
              [
                { id: 'EXPLORER', label: '1. Kho câu hỏi & Bộ đề', icon: BookOpen },
                {
                  id: 'EDITOR',
                  label: editingQuestionId ? '2. Đang sửa câu hỏi' : '2. Soạn câu hỏi (12 Dạng)',
                  icon: Edit3,
                },
                { id: 'MATRIX_BUILDER', label: '3. Rút đề theo Ma trận', icon: Layers },
                { id: 'AI_STUDIO', label: '4. Trợ lý AI tạo câu hỏi', icon: Sparkles },
                { id: 'IMPORT_EXPORT', label: '5. Nhập / Xuất Word · Excel · CSV', icon: FileSpreadsheet },
                { id: 'QUALITY_CATEGORIES', label: '6. Kiểm định chất lượng & Danh mục', icon: ShieldCheck },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id === 'QUALITY_CATEGORIES' && qualityIssues.length === 0) {
                      handleRunQualityCheck();
                    }
                  }}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors ${
                    active
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {feedbackMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
          <span>{feedbackMsg}</span>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-emerald-900 font-bold ml-4"
          >
            Đóng
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-red-900 font-bold ml-4"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Create Question Set Form */}
      {showCreateSet && canEdit && (
        <form
          onSubmit={handleCreateSet}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <h3 className="text-base font-bold text-slate-950">Khởi tạo bộ đề / bộ câu hỏi mới</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tên bộ câu hỏi
              </label>
              <input
                type="text"
                required
                value={newSetTitle}
                onChange={(e) => setNewSetTitle(e.target.value)}
                placeholder="VD: Đề kiểm tra 15 phút Chương 2 — Động lực học"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Môn học</label>
              <input
                type="text"
                required
                value={newSetSubject}
                onChange={(e) => setNewSetSubject(e.target.value)}
                placeholder="Toán học / Vật lý / Hóa học..."
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cấp học & Khối lớp
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newSetEducationLevel}
                  onChange={(e) => setNewSetEducationLevel(e.target.value)}
                  className="px-2.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Tiểu học">Tiểu học</option>
                  <option value="THCS">THCS</option>
                  <option value="THPT">THPT</option>
                  <option value="Đại học">Đại học</option>
                </select>
                <input
                  type="text"
                  required
                  value={newSetGrade}
                  onChange={(e) => setNewSetGrade(e.target.value)}
                  placeholder="Khối 12"
                  className="px-2.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Chủ đề</label>
              <input
                type="text"
                value={newSetTopic}
                onChange={(e) => setNewSetTopic(e.target.value)}
                placeholder="Chuyên đề / Chương..."
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Thời gian mặc định / câu (giây)
              </label>
              <input
                type="number"
                min={5}
                max={180}
                value={newSetDefaultTime}
                onChange={(e) => setNewSetDefaultTime(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Điểm mặc định / câu
              </label>
              <input
                type="number"
                min={100}
                max={10000}
                step={100}
                value={newSetDefaultPoints}
                onChange={(e) => setNewSetDefaultPoints(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newSetIsPublic}
                  onChange={(e) => setNewSetIsPublic(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Cho phép giáo viên khác tham khảo</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mô tả mục tiêu bộ đề
            </label>
            <input
              type="text"
              value={newSetDesc}
              onChange={(e) => setNewSetDesc(e.target.value)}
              placeholder="Mô tả ngắn gọn nội dung kiểm tra..."
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreateSet(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
            >
              Lưu bộ câu hỏi
            </button>
          </div>
        </form>
      )}

      {/* Main 2-Column Workspace: Left Question Sets Selector, Right Active Tool Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List of Sets */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="text-xs font-bold text-slate-800">Lọc bộ đề theo môn học</div>
            <div className="flex flex-wrap items-center gap-1">
              {subjects.map((subj) => (
                <button
                  key={subj}
                  type="button"
                  onClick={() => setSubjectFilter(subj)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    subjectFilter === subj
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {subj === 'ALL' ? 'Tất cả' : subj}
                </button>
              ))}
            </div>
          </div>

          {filteredSets.map((qSet) => {
            const isSelected = qSet.id === selectedSetId;
            return (
              <div
                key={qSet.id}
                onClick={() => setSelectedSetId(qSet.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-white border-slate-900 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mb-1">
                  <span className="font-semibold text-slate-700">{qSet.subject}</span>
                  <span aria-hidden="true">·</span>
                  <span>{qSet.gradeLevel}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums font-semibold text-slate-800">
                    {qSet.questionCount} câu
                  </span>
                  {typeof qSet.arenaSupportedCount === 'number' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums text-emerald-700">
                        {qSet.arenaSupportedCount} câu Đấu trường
                      </span>
                    </>
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-950 mb-1">{qSet.title}</h3>
                <p className="text-xs text-slate-500 line-clamp-2 mb-3">{qSet.description}</p>

                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400 truncate max-w-[160px]">
                    Tác giả: {qSet.creatorName}
                  </span>
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateSet(qSet.id);
                        }}
                        className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
                        title="Nhân bản bộ đề này"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Bản sao</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onLaunchRoomFromSet(qSet.id, true);
                      }}
                      className="font-semibold text-amber-700 hover:text-amber-800 inline-flex items-center gap-1"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Chơi thử</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Detail / Active Tool Panel */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6">
          {!activeSet ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Chọn một bộ câu hỏi ở danh sách bên trái để xem và thao tác.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Active Set Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
                    <span className="font-semibold text-slate-800">{activeSet.subject}</span>
                    <span aria-hidden="true">·</span>
                    <span>{activeSet.educationLevel || 'THPT'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{activeSet.gradeLevel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums font-semibold text-slate-900">
                      {questions.length} câu hỏi
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{activeSet.isPublic ? 'Công khai' : 'Nội bộ'}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-950">{activeSet.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">{activeSet.description}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onLaunchRoomFromSet(activeSet.id, true)}
                    className="px-3 py-2 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 text-amber-600" />
                    <span>Chơi thử</span>
                  </button>

                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={() => onLaunchRoomFromSet(activeSet.id, false)}
                        className="px-3 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg inline-flex items-center gap-1.5 transition-colors"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Mở phòng thi đấu (Sinh PIN)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowSharePanel(!showSharePanel)}
                        className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg"
                        title="Chia sẻ bộ câu hỏi"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSet(activeSet.id)}
                        className="p-2 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                        title="Xóa bộ câu hỏi này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Share Panel */}
              {showSharePanel && canEdit && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900">
                      Cài đặt chia sẻ bộ câu hỏi "{activeSet.title}"
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowSharePanel(false)}
                      className="text-xs text-slate-500 hover:text-slate-900"
                    >
                      Đóng
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeSet.isPublic}
                        onChange={(e) => handleToggleShareSet(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      <span>Chia sẻ công khai cho tất cả giáo viên trong trường</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={shareTeacherIdInput}
                        onChange={(e) => setShareTeacherIdInput(e.target.value)}
                        placeholder="Nhập ID giáo viên nhận chia sẻ..."
                        className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => handleToggleShareSet(activeSet.isPublic)}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg"
                      >
                        Cấp quyền
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* TAB 1: EXPLORER (QUESTION LIST, SEARCH, MULTI-FILTER, PREVIEW) */}
              {/* ============================================================ */}
              {activeTab === 'EXPLORER' && (
                <div className="space-y-4">
                  {/* Search & Multi-Criteria Filter Bar */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="md:col-span-2">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Tìm theo mã câu hỏi (QB-...), nội dung, chủ đề..."
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <select
                          value={filterType}
                          onChange={(e) => setFilterType(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                        >
                          <option value="ALL">Tất cả 12 dạng câu hỏi</option>
                          {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((qt) => (
                            <option key={qt} value={qt}>
                              {QUESTION_TYPE_LABELS[qt].label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <select
                          value={filterCognitive}
                          onChange={(e) => setFilterCognitive(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                        >
                          <option value="ALL">Mọi mức độ nhận thức</option>
                          {(Object.keys(COGNITIVE_LABELS) as CognitiveLevel[]).map((cl) => (
                            <option key={cl} value={cl}>
                              {COGNITIVE_LABELS[cl]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <select
                          value={filterDifficulty}
                          onChange={(e) => setFilterDifficulty(e.target.value)}
                          className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        >
                          <option value="ALL">Mọi độ khó</option>
                          {(Object.keys(DIFFICULTY_LABELS) as DifficultyLevel[]).map((df) => (
                            <option key={df} value={df}>
                              Độ khó: {DIFFICULTY_LABELS[df]}
                            </option>
                          ))}
                        </select>

                        <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filterArenaOnly}
                            onChange={(e) => setFilterArenaOnly(e.target.checked)}
                            className="rounded border-slate-300"
                          />
                          <span>Chỉ hiện câu tương thích Đấu trường trực tiếp</span>
                        </label>
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              resetQuestionEditor();
                              setActiveTab('EDITOR');
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Soạn câu hỏi mới</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {answersMasked && (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
                      <Lock className="w-4 h-4 shrink-0 text-amber-700" />
                      <span>
                        Chế độ bảo mật Học sinh: Máy chủ tự động ẩn đáp án đúng trong ngân hàng đề. Hãy bấm "Chơi thử" để kiểm tra kiến thức và xem kết quả chấm điểm từ máy chủ.
                      </span>
                    </div>
                  )}

                  {/* Preview Modal Card if a question is selected for preview */}
                  {previewQuestion && (
                    <div className="p-5 bg-slate-900 text-white rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-amber-400">
                          XEM TRƯỚC GIAO DIỆN THI ĐẤU · {previewQuestion.questionCode || previewQuestion.id}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPreviewQuestion(null)}
                          className="text-xs text-slate-300 hover:text-white font-semibold"
                        >
                          Đóng xem trước
                        </button>
                      </div>
                      <h4 className="text-base font-bold">{previewQuestion.prompt}</h4>
                      {previewQuestion.options && previewQuestion.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                          {previewQuestion.options.map((opt, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded-lg bg-slate-800 border border-slate-700 text-xs flex items-center gap-2"
                            >
                              <span className="font-mono font-bold text-amber-400">
                                {OPTION_KEYS[idx] || idx + 1}.
                              </span>
                              <span>{opt}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Question Cards List */}
                  {loadingQuestions ? (
                    <div className="py-10 text-center text-xs text-slate-500">
                      Đang tải danh sách câu hỏi...
                    </div>
                  ) : displayedQuestions.length === 0 ? (
                    <div className="py-10 text-center text-sm text-slate-500">
                      Không có câu hỏi nào khớp với bộ lọc hiện tại.
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {displayedQuestions.map((q, idx) => {
                        const fullQ = 'correctIndex' in q ? (q as FullQuestion) : null;
                        const qCorrectSet = new Set<number>(
                          fullQ?.correctIndices && fullQ.correctIndices.length > 0
                            ? fullQ.correctIndices
                            : fullQ
                              ? [fullQ.correctIndex]
                              : []
                        );
                        const typeMeta = QUESTION_TYPE_LABELS[q.questionType || 'SINGLE_CHOICE'] || {
                          label: q.questionType,
                          arenaSupported: true,
                        };
                        const isChecked = selectedQuestionIds.includes(q.id);

                        return (
                          <div
                            key={q.id}
                            className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5">
                                {canEdit && (
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedQuestionIds((prev) => [...prev, q.id]);
                                      } else {
                                        setSelectedQuestionIds((prev) =>
                                          prev.filter((id) => id !== q.id)
                                        );
                                      }
                                    }}
                                    className="mt-1 rounded border-slate-300"
                                  />
                                )}
                                <div>
                                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mb-1">
                                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                                      Câu {idx + 1} ({q.questionCode || q.id.slice(0, 8)})
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-semibold text-amber-700">
                                      {typeMeta.label}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-slate-700">
                                      {COGNITIVE_LABELS[q.cognitiveLevel || 'REMEMBER']}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-slate-700">
                                      Độ khó: {DIFFICULTY_LABELS[q.difficulty || 'MEDIUM']}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span className="tabular-nums">{q.timeLimitSec}s</span>
                                    <span aria-hidden="true">·</span>
                                    <span className="tabular-nums">{q.points}đ</span>
                                    <span aria-hidden="true">·</span>
                                    <span
                                      className={
                                        q.isArenaSupported !== false
                                          ? 'text-emerald-700 font-semibold'
                                          : 'text-slate-500'
                                      }
                                    >
                                      {q.isArenaSupported !== false
                                        ? 'Hỗ trợ Đấu trường Live'
                                        : 'Chấm tự luận / Bài tập'}
                                    </span>
                                  </div>
                                  <h4 className="text-sm font-bold text-slate-950">{q.prompt}</h4>
                                  {(q.topic || q.lesson) && (
                                    <div className="text-xs text-slate-500 mt-0.5">
                                      Chủ đề: {q.topic || 'Chung'}
                                      {q.lesson ? ` · Bài: ${q.lesson}` : ''}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setPreviewQuestion(q)}
                                  className="p-1.5 text-slate-500 hover:text-slate-900 rounded"
                                  title="Xem trước câu hỏi"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                {canEdit && fullQ && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleMoveQuestionOrder(idx, 'UP')}
                                      disabled={idx === 0}
                                      className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded"
                                      title="Chuyển lên"
                                    >
                                      <ArrowUp className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleMoveQuestionOrder(idx, 'DOWN')}
                                      disabled={idx === displayedQuestions.length - 1}
                                      className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded"
                                      title="Chuyển xuống"
                                    >
                                      <ArrowDown className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openEditQuestion(fullQ)}
                                      className="p-1.5 text-slate-500 hover:text-slate-900 rounded"
                                      title="Chỉnh sửa câu hỏi"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDuplicateQuestion(q.id)}
                                      className="p-1.5 text-slate-500 hover:text-slate-900 rounded"
                                      title="Sao chép câu hỏi"
                                    >
                                      <Copy className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveQuestionFromSetOnly(q.id)}
                                      className="px-2 py-1 text-xs text-slate-600 hover:text-amber-700 rounded"
                                      title="Gỡ khỏi bộ đề này nhưng giữ lại trong kho câu hỏi"
                                    >
                                      Gỡ khỏi đề
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteQuestionPermanently(q.id)}
                                      className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                                      title="Xóa vĩnh viễn câu hỏi"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {q.imageUrl && (
                              <div className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg p-2">
                                <ImageIcon className="w-4 h-4 text-slate-500 shrink-0" />
                                <span className="truncate font-mono">{q.imageUrl}</span>
                              </div>
                            )}

                            {/* Render options or specialized answer format */}
                            {q.options && q.options.length > 0 && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {q.options.map((opt, optIdx) => {
                                  const isCorrect = fullQ && qCorrectSet.has(optIdx);
                                  return (
                                    <div
                                      key={optIdx}
                                      className={`px-3 py-2 rounded-lg border text-xs flex items-center justify-between ${
                                        isCorrect
                                          ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-semibold'
                                          : 'bg-white border-slate-200 text-slate-700'
                                      }`}
                                    >
                                      <span>
                                        <strong className="font-mono mr-1.5">
                                          {OPTION_KEYS[optIdx] || optIdx + 1}.
                                        </strong>
                                        {opt}
                                      </span>
                                      {isCorrect && (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {fullQ &&
                              (q.questionType === 'FILL_IN_BLANK' ||
                                q.questionType === 'SHORT_ANSWER' ||
                                q.questionType === 'ESSAY') && (
                                <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700">
                                  <strong>Đáp án chuẩn / Hướng dẫn chấm:</strong>{' '}
                                  {fullQ.correctAnswerText || 'Giáo viên chấm tự luận'}
                                </div>
                              )}

                            {fullQ &&
                              q.questionType === 'MATCHING' &&
                              fullQ.matchingPairs &&
                              fullQ.matchingPairs.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {fullQ.matchingPairs.map((pair, pIdx) => (
                                    <div
                                      key={pIdx}
                                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs flex items-center justify-between"
                                    >
                                      <span className="font-semibold">{pair.left}</span>
                                      <span className="text-slate-400">→</span>
                                      <span className="text-emerald-800 font-semibold">
                                        {pair.right}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                            {fullQ && fullQ.explanation && (
                              <div className="text-xs text-slate-600 pt-2 border-t border-slate-200">
                                <strong className="text-slate-800">Giải thích:</strong>{' '}
                                {fullQ.explanation}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================ */}
              {/* TAB 2: QUESTION EDITOR (ALL 12 TYPES & 20 METADATA FIELDS)   */}
              {/* ============================================================ */}
              {activeTab === 'EDITOR' && canEdit && (
                <form
                  onSubmit={handleSaveQuestion}
                  className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-950">
                        {editingQuestionId
                          ? `Chỉnh sửa câu hỏi (${editingQuestionId})`
                          : `Soạn câu hỏi mới vào bộ đề "${activeSet.title}"`}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {QUESTION_TYPE_LABELS[qType].arenaSupported
                          ? 'Dạng câu hỏi này tương thích trực tiếp với Đấu trường thời gian thực.'
                          : 'Dạng câu hỏi này dùng cho Đề kiểm tra mở rộng hoặc Giáo viên chấm thủ công.'}
                      </p>
                    </div>
                    {editingQuestionId && (
                      <button
                        type="button"
                        onClick={resetQuestionEditor}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg"
                      >
                        Chuyển sang tạo câu mới
                      </button>
                    )}
                  </div>

                  {/* Row 1: Question Type, Cognitive Level, Difficulty, Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Dạng câu hỏi (12 dạng)
                      </label>
                      <select
                        value={qType}
                        onChange={(e) => {
                          const nextType = e.target.value as QuestionType;
                          setQType(nextType);
                          if (nextType === 'TRUE_FALSE') {
                            setOptA('Đúng');
                            setOptB('Sai');
                            setQCorrectIndex(0);
                          }
                        }}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-semibold"
                      >
                        {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((qt) => (
                          <option key={qt} value={qt}>
                            {QUESTION_TYPE_LABELS[qt].label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Mức độ nhận thức
                      </label>
                      <select
                        value={qCognitive}
                        onChange={(e) => setQCognitive(e.target.value as CognitiveLevel)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      >
                        {(Object.keys(COGNITIVE_LABELS) as CognitiveLevel[]).map((cl) => (
                          <option key={cl} value={cl}>
                            {COGNITIVE_LABELS[cl]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Độ khó
                      </label>
                      <select
                        value={qDifficulty}
                        onChange={(e) => setQDifficulty(e.target.value as DifficultyLevel)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      >
                        {(Object.keys(DIFFICULTY_LABELS) as DifficultyLevel[]).map((df) => (
                          <option key={df} value={df}>
                            {DIFFICULTY_LABELS[df]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Trạng thái sử dụng
                      </label>
                      <select
                        value={qUsageStatus}
                        onChange={(e) => setQUsageStatus(e.target.value as QuestionUsageStatus)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      >
                        {(Object.keys(STATUS_LABELS) as QuestionUsageStatus[]).map((st) => (
                          <option key={st} value={st}>
                            {STATUS_LABELS[st]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 2: 5 Classification Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Cấp học
                      </label>
                      <select
                        value={qEducationLevel}
                        onChange={(e) => setQEducationLevel(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="Tiểu học">Tiểu học</option>
                        <option value="THCS">THCS</option>
                        <option value="THPT">THPT</option>
                        <option value="Đại học">Đại học</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Khối lớp
                      </label>
                      <input
                        type="text"
                        value={qGradeLevel}
                        onChange={(e) => setQGradeLevel(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Môn học
                      </label>
                      <input
                        type="text"
                        value={qSubject}
                        onChange={(e) => setQSubject(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Chủ đề / Chương
                      </label>
                      <input
                        type="text"
                        value={qTopic}
                        onChange={(e) => setQTopic(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Bài học
                      </label>
                      <input
                        type="text"
                        value={qLesson}
                        onChange={(e) => setQLesson(e.target.value)}
                        placeholder="VD: Bài 1..."
                        className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Prompt */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nội dung câu hỏi
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={qPrompt}
                      onChange={(e) => setQPrompt(e.target.value)}
                      placeholder="Nhập đề bài câu hỏi rõ ràng, đầy đủ dữ kiện..."
                      className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  {/* Media Attachments */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        URL Hình ảnh minh họa (Tùy chọn)
                      </label>
                      <input
                        type="text"
                        value={qImageUrl}
                        onChange={(e) => setQImageUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        URL Âm thanh (Audio Question)
                      </label>
                      <input
                        type="text"
                        value={qAudioUrl}
                        onChange={(e) => setQAudioUrl(e.target.value)}
                        placeholder="https://...mp3"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        URL Video (Video Question)
                      </label>
                      <input
                        type="text"
                        value={qVideoUrl}
                        onChange={(e) => setQVideoUrl(e.target.value)}
                        placeholder="https://...mp4"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Dynamic Answer Editor by Question Type */}
                  {qType === 'TRUE_FALSE' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold">
                        Phương án A: Đúng
                      </div>
                      <div className="p-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold">
                        Phương án B: Sai
                      </div>
                    </div>
                  ) : qType === 'FILL_IN_BLANK' ||
                    qType === 'SHORT_ANSWER' ||
                    qType === 'ESSAY' ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {qType === 'ESSAY'
                          ? 'Hướng dẫn chấm / Đáp án tham khảo (Giáo viên chấm thủ công)'
                          : 'Đáp án chuẩn (Từ/cụm từ chính xác cần điền)'}
                      </label>
                      <input
                        type="text"
                        required={qType !== 'ESSAY'}
                        value={qCorrectAnswerText}
                        onChange={(e) => setQCorrectAnswerText(e.target.value)}
                        placeholder="Nhập đáp án chuẩn..."
                        className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  ) : qType === 'MATCHING' ? (
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Các cặp ghép đôi tương ứng (Vế trái — Vế phải)
                      </label>
                      {qMatchingPairs.map((pair, pIdx) => (
                        <div key={pIdx} className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            required
                            value={pair.left}
                            onChange={(e) => {
                              const next = [...qMatchingPairs];
                              next[pIdx] = { ...next[pIdx], left: e.target.value };
                              setQMatchingPairs(next);
                            }}
                            placeholder={`Mục vế trái ${pIdx + 1}`}
                            className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                          />
                          <input
                            type="text"
                            required
                            value={pair.right}
                            onChange={(e) => {
                              const next = [...qMatchingPairs];
                              next[pIdx] = { ...next[pIdx], right: e.target.value };
                              setQMatchingPairs(next);
                            }}
                            placeholder={`Mục vế phải ${pIdx + 1}`}
                            className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setQMatchingPairs([...qMatchingPairs, { left: '', right: '' }])
                        }
                        className="text-xs font-semibold text-slate-700 hover:text-slate-950"
                      >
                        + Thêm cặp ghép đôi
                      </button>
                    </div>
                  ) : qType === 'ORDERING' ? (
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Nhập các mục theo đúng thứ tự chuẩn từ trên xuống dưới
                      </label>
                      {qOrderingItems.map((item, oIdx) => (
                        <input
                          key={oIdx}
                          type="text"
                          required
                          value={item}
                          onChange={(e) => {
                            const next = [...qOrderingItems];
                            next[oIdx] = e.target.value;
                            setQOrderingItems(next);
                          }}
                          placeholder={`Bước / Thứ tự ${oIdx + 1}`}
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() => setQOrderingItems([...qOrderingItems, ''])}
                        className="text-xs font-semibold text-slate-700 hover:text-slate-950"
                      >
                        + Thêm bước sắp xếp
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Phương án A
                        </label>
                        <input
                          type="text"
                          required
                          value={optA}
                          onChange={(e) => setOptA(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Phương án B
                        </label>
                        <input
                          type="text"
                          required
                          value={optB}
                          onChange={(e) => setOptB(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Phương án C
                        </label>
                        <input
                          type="text"
                          required
                          value={optC}
                          onChange={(e) => setOptC(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Phương án D
                        </label>
                        <input
                          type="text"
                          required
                          value={optD}
                          onChange={(e) => setOptD(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                  )}

                  {/* Correct Answer Choice, Time Limit & Points */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {qType === 'MULTIPLE_CHOICE' ? 'Chọn các đáp án đúng' : 'Đáp án đúng'}
                      </label>
                      {qType === 'MULTIPLE_CHOICE' ? (
                        <div className="flex items-center gap-2 pt-1">
                          {OPTION_KEYS.map((key, idx) => {
                            const checked = qCorrectIndices.includes(idx);
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => handleToggleMultiCorrect(idx)}
                                className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg border transition-colors ${
                                  checked
                                    ? 'bg-emerald-600 text-white border-emerald-700'
                                    : 'bg-white text-slate-700 border-slate-300'
                                }`}
                              >
                                {key}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <select
                          value={qCorrectIndex}
                          onChange={(e) => setQCorrectIndex(Number(e.target.value))}
                          disabled={
                            qType === 'FILL_IN_BLANK' ||
                            qType === 'SHORT_ANSWER' ||
                            qType === 'MATCHING' ||
                            qType === 'ORDERING' ||
                            qType === 'ESSAY'
                          }
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                        >
                          <option value={0}>
                            {qType === 'TRUE_FALSE' ? 'Phương án A (Đúng)' : 'Phương án A'}
                          </option>
                          <option value={1}>
                            {qType === 'TRUE_FALSE' ? 'Phương án B (Sai)' : 'Phương án B'}
                          </option>
                          {qType !== 'TRUE_FALSE' && (
                            <>
                              <option value={2}>Phương án C</option>
                              <option value={3}>Phương án D</option>
                            </>
                          )}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Thời gian trả lời (giây)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={300}
                        value={qTimeSec}
                        onChange={(e) => setQTimeSec(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Điểm cơ bản
                      </label>
                      <input
                        type="number"
                        min={100}
                        max={10000}
                        step={100}
                        value={qPoints}
                        onChange={(e) => setQPoints(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg tabular-nums"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Lời giải / Giải thích đáp án
                    </label>
                    <textarea
                      rows={2}
                      value={qExplanation}
                      onChange={(e) => setQExplanation(e.target.value)}
                      placeholder="Giải thích công thức, định lý hoặc lý do chọn đáp án đúng..."
                      className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        resetQuestionEditor();
                        setActiveTab('EXPLORER');
                      }}
                      className="px-4 py-2 text-xs font-semibold text-slate-600"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
                    >
                      {editingQuestionId ? 'Cập nhật câu hỏi' : 'Lưu câu hỏi vào bộ đề'}
                    </button>
                  </div>
                </form>
              )}

              {/* ============================================================ */}
              {/* TAB 3: MATRIX QUIZ BUILDER (SECTION V)                       */}
              {/* ============================================================ */}
              {activeTab === 'MATRIX_BUILDER' && canEdit && (
                <div className="space-y-4">
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-950">
                        Tự động rút trích câu hỏi theo Ma trận Nhận thức & Độ khó
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Hệ thống sẽ tìm trong toàn bộ ngân hàng câu hỏi để chọn ngẫu nhiên số lượng câu hỏi theo từng mức độ nhận thức và ghép vào bộ đề "{activeSet.title}".
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Số câu Nhận biết
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={matrixRemember}
                          onChange={(e) => setMatrixRemember(Number(e.target.value))}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Số câu Thông hiểu
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={matrixUnderstand}
                          onChange={(e) => setMatrixUnderstand(Number(e.target.value))}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Số câu Vận dụng
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={matrixApply}
                          onChange={(e) => setMatrixApply(Number(e.target.value))}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Số câu Vận dụng cao
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={matrixHighApply}
                          onChange={(e) => setMatrixHighApply(Number(e.target.value))}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={matrixArenaOnly}
                          onChange={(e) => setMatrixArenaOnly(e.target.checked)}
                          className="rounded border-slate-300"
                        />
                        <span>Chỉ chọn các câu hỏi hỗ trợ Đấu trường trực tiếp</span>
                      </label>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={loadingMatrix}
                          onClick={() => handlePreviewOrApplyMatrix(false)}
                          className="px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg"
                        >
                          Xem trước danh sách rút trích
                        </button>
                        <button
                          type="button"
                          disabled={loadingMatrix}
                          onClick={() => handlePreviewOrApplyMatrix(true)}
                          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
                        >
                          Áp dụng ngay vào bộ đề
                        </button>
                      </div>
                    </div>
                  </div>

                  {matrixPreviewQuestions.length > 0 && (
                    <div className="space-y-2.5">
                      <h5 className="text-xs font-bold text-slate-800">
                        Kết quả xem trước ({matrixPreviewQuestions.length} câu hỏi được chọn):
                      </h5>
                      {matrixPreviewQuestions.map((mq, idx) => (
                        <div
                          key={mq.id}
                          className="p-3 bg-white border border-slate-200 rounded-lg text-xs flex items-center justify-between gap-3"
                        >
                          <div>
                            <span className="font-mono font-bold mr-2">
                              #{idx + 1} ({mq.questionCode})
                            </span>
                            <span className="font-semibold text-slate-900">{mq.prompt}</span>
                          </div>
                          <span className="text-slate-500 shrink-0">
                            {COGNITIVE_LABELS[mq.cognitiveLevel || 'REMEMBER']} ·{' '}
                            {DIFFICULTY_LABELS[mq.difficulty || 'MEDIUM']}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================ */}
              {/* TAB 4: AI ASSISTANT STUDIO (PROMPT, DOCUMENT, IMAGE)         */}
              {/* ============================================================ */}
              {activeTab === 'AI_STUDIO' && canEdit && (
                <div className="space-y-4">
                  {/* AI Status Banner */}
                  {aiStatus && (
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="font-semibold text-slate-800">{aiStatus.message}</span>
                      </div>
                      <span className="font-mono text-slate-500 tabular-nums">
                        Model: {aiStatus.modelAlias} · Hạn mức còn lại:{' '}
                        {aiStatus.remainingRequestsPerMinute}/15 lượt/phút
                      </span>
                    </div>
                  )}

                  {/* 3 AI Generation Modes */}
                  <div className="flex flex-wrap items-center gap-2">
                    {(
                      [
                        { id: 'PROMPT', label: 'A. Tạo từ yêu cầu tự nhiên' },
                        { id: 'DOCUMENT', label: 'B. Tạo từ Tài liệu (Word / Văn bản)' },
                        { id: 'IMAGE', label: 'C. Tạo từ Hình ảnh / Sơ đồ' },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setAiMode(m.id)}
                        className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
                          aiMode === m.id
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* Shared Pedagogical Parameters */}
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Môn học
                        </label>
                        <input
                          type="text"
                          value={aiSubject}
                          onChange={(e) => setAiSubject(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Khối lớp
                        </label>
                        <input
                          type="text"
                          value={aiGrade}
                          onChange={(e) => setAiGrade(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Số lượng câu hỏi cần tạo (1–15)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={15}
                          value={aiCount}
                          onChange={(e) => setAiCount(Number(e.target.value))}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Dạng câu hỏi
                        </label>
                        <select
                          value={aiQType}
                          onChange={(e) => setAiQType(e.target.value as QuestionType)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                        >
                          {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((qt) => (
                            <option key={qt} value={qt}>
                              {QUESTION_TYPE_LABELS[qt].label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Mức độ nhận thức
                        </label>
                        <select
                          value={aiCognitive}
                          onChange={(e) => setAiCognitive(e.target.value as CognitiveLevel)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                        >
                          {(Object.keys(COGNITIVE_LABELS) as CognitiveLevel[]).map((cl) => (
                            <option key={cl} value={cl}>
                              {COGNITIVE_LABELS[cl]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Độ khó
                        </label>
                        <select
                          value={aiDifficulty}
                          onChange={(e) => setAiDifficulty(e.target.value as DifficultyLevel)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                        >
                          {(Object.keys(DIFFICULTY_LABELS) as DifficultyLevel[]).map((df) => (
                            <option key={df} value={df}>
                              {DIFFICULTY_LABELS[df]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {aiMode === 'PROMPT' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Chủ đề / Nội dung kiến thức cần tạo câu hỏi
                          </label>
                          <input
                            type="text"
                            value={aiTopic}
                            onChange={(e) => setAiTopic(e.target.value)}
                            placeholder="VD: Định luật bảo toàn động lượng, Chiến dịch Điện Biên Phủ..."
                            className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Yêu cầu sư phạm bổ sung (Tùy chọn)
                          </label>
                          <input
                            type="text"
                            value={aiInstructions}
                            onChange={(e) => setAiInstructions(e.target.value)}
                            placeholder="VD: Tập trung vào bài toán thực tế, có giải thích công thức..."
                            className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                      </div>
                    )}

                    {aiMode === 'DOCUMENT' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Tải tệp tài liệu (.docx, .txt, .csv) hoặc dán trực tiếp nội dung bài giảng
                          </label>
                          <input
                            type="file"
                            accept=".docx,.txt,.csv"
                            onChange={handleAiDocFileChange}
                            className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white"
                          />
                          {aiDocFileName && (
                            <div className="text-xs text-emerald-700 mt-1">
                              Đã nạp tệp: {aiDocFileName}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Hoặc dán văn bản kiến thức nguồn (AI chỉ tạo câu hỏi từ văn bản này, không tự suy diễn ngoài tài liệu)
                          </label>
                          <textarea
                            rows={4}
                            value={aiDocText}
                            onChange={(e) => setAiDocText(e.target.value)}
                            placeholder="Dán nội dung bài học, đề cương ôn tập (tối thiểu 40 ký tự)..."
                            className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                      </div>
                    )}

                    {aiMode === 'IMAGE' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Tải hình ảnh trang sách, sơ đồ tư duy, bảng biểu hoặc hình minh họa (.png, .jpg, .webp)
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleAiImageFileChange}
                            className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white"
                          />
                          {aiImageFileName && (
                            <div className="text-xs text-emerald-700 mt-1">
                              Đã chọn ảnh: {aiImageFileName}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Hướng dẫn phân tích hình ảnh cho AI (Tùy chọn)
                          </label>
                          <input
                            type="text"
                            value={aiInstructions}
                            onChange={(e) => setAiInstructions(e.target.value)}
                            placeholder="VD: Đặt câu hỏi nhận diện các bộ phận đánh số trên sơ đồ..."
                            className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={aiLoading}
                        onClick={handleRunAiGenerator}
                        className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span>
                          {aiLoading
                            ? 'Trợ lý AI đang phân tích & biên soạn...'
                            : 'Biên soạn bản nháp câu hỏi'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* AI Draft Results (Requires Teacher Review & Approval before saving) */}
                  {(aiSummary || aiDrafts.length > 0) && (
                    <div className="space-y-4">
                      {aiSummary && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs text-amber-950">
                          <div className="font-bold">Tóm tắt từ Trợ lý AI:</div>
                          <p>{aiSummary}</p>
                          {aiKeyPoints.length > 0 && (
                            <ul className="list-disc list-inside space-y-1 pt-1">
                              {aiKeyPoints.map((kp, i) => (
                                <li key={i}>{kp}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      {aiDrafts.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h5 className="text-sm font-bold text-slate-950">
                              Bản nháp câu hỏi đề xuất ({aiDrafts.length} câu) — Giáo viên kiểm duyệt trước khi lưu
                            </h5>
                            <button
                              type="button"
                              onClick={handleSaveAllAiDrafts}
                              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
                            >
                              Duyệt & Lưu tất cả vào "{activeSet.title}"
                            </button>
                          </div>

                          {aiDrafts.map((draft, dIdx) => (
                            <div
                              key={dIdx}
                              className="p-4 bg-white border border-slate-200 rounded-xl space-y-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-700">
                                  Dự thảo #{dIdx + 1} · {QUESTION_TYPE_LABELS[draft.questionType]?.label} ·{' '}
                                  {COGNITIVE_LABELS[draft.cognitiveLevel]} · Độ khó:{' '}
                                  {DIFFICULTY_LABELS[draft.difficulty]}
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setAiDrafts((prev) => prev.filter((_, i) => i !== dIdx))
                                    }
                                    className="px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                                  >
                                    Loại bỏ
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveAiDraftToBank(draft, dIdx)}
                                    className="px-3 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
                                  >
                                    Duyệt & Lưu câu này
                                  </button>
                                </div>
                              </div>

                              <input
                                type="text"
                                value={draft.prompt}
                                onChange={(e) => {
                                  const next = [...aiDrafts];
                                  next[dIdx] = { ...next[dIdx], prompt: e.target.value };
                                  setAiDrafts(next);
                                }}
                                className="w-full px-3 py-1.5 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-lg"
                              />

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {draft.options.map((opt, oIdx) => (
                                  <div key={oIdx} className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const next = [...aiDrafts];
                                        next[dIdx] = {
                                          ...next[dIdx],
                                          correctIndex: oIdx,
                                          correctIndices: [oIdx],
                                        };
                                        setAiDrafts(next);
                                      }}
                                      className={`px-2 py-1 text-xs font-mono font-bold rounded ${
                                        draft.correctIndex === oIdx
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-slate-200 text-slate-700'
                                      }`}
                                    >
                                      {OPTION_KEYS[oIdx] || oIdx + 1}
                                    </button>
                                    <input
                                      type="text"
                                      value={opt}
                                      onChange={(e) => {
                                        const next = [...aiDrafts];
                                        const nextOpts = [...next[dIdx].options];
                                        nextOpts[oIdx] = e.target.value;
                                        next[dIdx] = { ...next[dIdx], options: nextOpts };
                                        setAiDrafts(next);
                                      }}
                                      className="w-full px-2.5 py-1 text-xs bg-white border border-slate-300 rounded"
                                    />
                                  </div>
                                ))}
                              </div>

                              <input
                                type="text"
                                value={draft.explanation}
                                onChange={(e) => {
                                  const next = [...aiDrafts];
                                  next[dIdx] = { ...next[dIdx], explanation: e.target.value };
                                  setAiDrafts(next);
                                }}
                                placeholder="Lời giải thích..."
                                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================ */}
              {/* TAB 5: BULK IMPORT & EXPORT (WORD, EXCEL, CSV, JSON)         */}
              {/* ============================================================ */}
              {activeTab === 'IMPORT_EXPORT' && canEdit && (
                <div className="space-y-6">
                  {/* Bulk Import Section */}
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-950">
                          Nhập câu hỏi hàng loạt từ Word (.docx), Excel (.xlsx, .xls) và CSV (.csv)
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Hệ thống tự động kiểm tra câu hỏi trùng lặp, thiếu đáp án, sai định dạng và cho phép xem trước trước khi lưu vào bộ đề "{activeSet.title}".
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownloadTemplate('XLSX')}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg inline-flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Tải file mẫu Excel (.xlsx)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadTemplate('CSV')}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg inline-flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Tải file mẫu CSV</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-4 bg-white border border-dashed border-slate-300 rounded-xl flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Upload className="w-5 h-5 text-slate-500" />
                        <div className="text-xs">
                          <div className="font-semibold text-slate-900">
                            Chọn tệp dữ liệu câu hỏi từ máy tính (.xlsx, .xls, .csv, .docx)
                          </div>
                          <div className="text-slate-500">
                            Hỗ trợ bảng tính tiêu chuẩn hoặc tài liệu Word định dạng "Câu 1: ... A. ... B. ... Đáp án: A"
                          </div>
                        </div>
                      </div>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv,.docx"
                        onChange={handleImportFileChange}
                        className="text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white"
                      />
                    </div>

                    {importLoading && (
                      <div className="text-xs text-slate-600">
                        Đang phân tích cấu trúc tệp và kiểm tra lỗi dữ liệu...
                      </div>
                    )}

                    {importPreview && (
                      <div className="space-y-4 pt-2 border-t border-slate-200">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-xs space-x-3">
                            <span className="font-bold text-slate-900">
                              Tệp: {importPreview.fileName} ({importPreview.format})
                            </span>
                            <span className="tabular-nums">
                              Tổng số: <strong>{importPreview.totalRows}</strong> câu
                            </span>
                            <span className="text-emerald-700 tabular-nums">
                              Hợp lệ: <strong>{importPreview.validCount}</strong>
                            </span>
                            <span className="text-red-600 tabular-nums">
                              Lỗi: <strong>{importPreview.errorCount}</strong>
                            </span>
                            <span className="text-amber-700 tabular-nums">
                              Trùng lặp: <strong>{importPreview.duplicateCount}</strong>
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={importSkipInvalid}
                                onChange={(e) => setImportSkipInvalid(e.target.checked)}
                              />
                              <span>Bỏ qua dòng lỗi</span>
                            </label>
                            <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={importSkipDuplicates}
                                onChange={(e) => setImportSkipDuplicates(e.target.checked)}
                              />
                              <span>Bỏ qua câu trùng</span>
                            </label>
                            <button
                              type="button"
                              onClick={handleCommitImport}
                              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
                            >
                              Xác nhận lưu vào bộ đề
                            </button>
                          </div>
                        </div>

                        <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                                <th className="p-2.5">Dòng</th>
                                <th className="p-2.5">Nội dung câu hỏi</th>
                                <th className="p-2.5">Dạng</th>
                                <th className="p-2.5">Đáp án đúng</th>
                                <th className="p-2.5">Trạng thái kiểm tra</th>
                              </tr>
                            </thead>
                            <tbody>
                              {importPreview.rows.map((r: any) => (
                                <tr key={r.rowIndex} className="border-b border-slate-100">
                                  <td className="p-2.5 font-mono tabular-nums">#{r.rowIndex}</td>
                                  <td className="p-2.5 font-semibold text-slate-900 max-w-xs truncate">
                                    {r.prompt || '(Trống)'}
                                  </td>
                                  <td className="p-2.5">{r.questionType}</td>
                                  <td className="p-2.5 font-mono">
                                    {r.correctAnswerText || OPTION_KEYS[r.correctIndex] || 'A'}
                                  </td>
                                  <td className="p-2.5">
                                    {!r.isValid ? (
                                      <span className="text-red-600 font-semibold">
                                        Lỗi: {r.errors.join('; ')}
                                      </span>
                                    ) : r.isDuplicate ? (
                                      <span className="text-amber-700 font-semibold">
                                        Cảnh báo trùng lặp
                                      </span>
                                    ) : (
                                      <span className="text-emerald-700 font-semibold">Hợp lệ</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Export Section (Section VII) */}
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-950">
                        Xuất câu hỏi & Đề thi ra Word (.doc), Excel (.xlsx), CSV (.csv), JSON (.json)
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Hỗ trợ xuất bản đầy đủ (có đáp án và lời giải cho giáo viên) hoặc bản đề thi luyện tập (ẩn đáp án cho học sinh).
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Phạm vi câu hỏi cần xuất
                        </label>
                        <select
                          value={exportScope}
                          onChange={(e) => setExportScope(e.target.value as any)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                        >
                          <option value="CURRENT_SET">
                            Toàn bộ bộ đề đang chọn ({questions.length} câu)
                          </option>
                          <option value="SELECTED">
                            Các câu hỏi đang tích chọn ({selectedQuestionIds.length} câu)
                          </option>
                          <option value="ALL_BANK">Toàn bộ ngân hàng câu hỏi</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Định dạng tệp xuất
                        </label>
                        <select
                          value={exportFormat}
                          onChange={(e) => setExportFormat(e.target.value as any)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                        >
                          <option value="XLSX">Bảng tính Excel (.xlsx)</option>
                          <option value="CSV">Tệp dữ liệu CSV (.csv)</option>
                          <option value="DOCX">Tài liệu Microsoft Word (.doc)</option>
                          <option value="JSON">Cấu trúc dữ liệu JSON (.json)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Chế độ hiển thị đáp án
                        </label>
                        <select
                          value={exportIncludeAnswers ? 'FULL' : 'STUDENT_ONLY'}
                          onChange={(e) => setExportIncludeAnswers(e.target.value === 'FULL')}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                        >
                          <option value="FULL">Bản đầy đủ (Có đáp án & giải thích)</option>
                          <option value="STUDENT_ONLY">Bản đề thi cho học sinh (Ẩn đáp án)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleExportQuestions}
                        className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>Tải tệp xuất xuống máy tính</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* TAB 6: QUALITY CHECKER & MULTI-LEVEL CATEGORIES              */}
              {/* ============================================================ */}
              {activeTab === 'QUALITY_CATEGORIES' && canEdit && (
                <div className="space-y-6">
                  {/* Quality Audit Section (Section XI) */}
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-950">
                          Kiểm định chất lượng câu hỏi tự động
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Rà soát câu hỏi trùng lặp, thiếu đáp án, thiếu giải thích, câu hỏi quá ngắn hoặc độ khó chưa khớp mức độ nhận thức.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={loadingQuality}
                          onClick={() => handleRunQualityCheck(selectedSetId)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg inline-flex items-center gap-1"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Quét bộ đề hiện tại</span>
                        </button>
                        <button
                          type="button"
                          disabled={loadingQuality}
                          onClick={() => handleRunQualityCheck(undefined)}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg inline-flex items-center gap-1"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Quét toàn bộ ngân hàng</span>
                        </button>
                      </div>
                    </div>

                    {qualityIssues.length === 0 ? (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900">
                        Không phát hiện lỗi cấu trúc hoặc trùng lặp nào trong phạm vi vừa quét.
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-80 overflow-y-auto">
                        {qualityIssues.map((issue, idx) => (
                          <div
                            key={`${issue.questionId}_${idx}`}
                            className={`p-3.5 rounded-lg border text-xs space-y-1 ${
                              issue.severity === 'ERROR'
                                ? 'bg-red-50 border-red-200 text-red-900'
                                : 'bg-amber-50 border-amber-200 text-amber-950'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold">
                                {issue.questionCode} · {issue.issueType}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const found = questions.find((q) => q.id === issue.questionId);
                                  if (found && 'correctIndex' in found) {
                                    openEditQuestion(found as FullQuestion);
                                  }
                                }}
                                className="underline font-semibold"
                              >
                                Mở trình sửa câu hỏi
                              </button>
                            </div>
                            <div className="font-semibold">{issue.message}</div>
                            <div className="text-slate-600">Gợi ý: {issue.suggestion}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Multi-Level Category Manager (Section IV) */}
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-950">
                        Quản lý Danh mục phân loại đa cấp (Cấp học · Khối lớp · Môn · Chủ đề · Bài học)
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Chuẩn hóa cây danh mục giúp giáo viên phân loại và tìm kiếm câu hỏi nhanh chóng.
                      </p>
                    </div>

                    <form
                      onSubmit={handleCreateCategory}
                      className="grid grid-cols-1 sm:grid-cols-6 gap-2.5"
                    >
                      <input
                        type="text"
                        required
                        value={catName}
                        onChange={(e) => setCatName(e.target.value)}
                        placeholder="Tên danh mục..."
                        className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                      <select
                        value={catEduLevel}
                        onChange={(e) => setCatEduLevel(e.target.value)}
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="Tiểu học">Tiểu học</option>
                        <option value="THCS">THCS</option>
                        <option value="THPT">THPT</option>
                        <option value="Đại học">Đại học</option>
                      </select>
                      <input
                        type="text"
                        required
                        value={catGrade}
                        onChange={(e) => setCatGrade(e.target.value)}
                        placeholder="Khối lớp"
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                      <input
                        type="text"
                        required
                        value={catSubject}
                        onChange={(e) => setCatSubject(e.target.value)}
                        placeholder="Môn học"
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                      <input
                        type="text"
                        value={catTopic}
                        onChange={(e) => setCatTopic(e.target.value)}
                        placeholder="Chủ đề"
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg"
                      >
                        + Thêm danh mục
                      </button>
                    </form>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {categories.map((cat) => (
                        <div
                          key={cat.id}
                          className="p-3 bg-white border border-slate-200 rounded-lg text-xs flex items-center justify-between"
                        >
                          <div>
                            <div className="font-bold text-slate-900">{cat.name}</div>
                            <div className="text-slate-500">
                              {cat.educationLevel} · {cat.gradeLevel} · {cat.subject} · Chủ đề:{' '}
                              {cat.topic}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-1 text-slate-400 hover:text-red-600"
                            title="Xóa danh mục"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
