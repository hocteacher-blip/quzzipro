import { Router } from 'express';
import type { AuthenticatedRequest } from '../../auth.ts';
import type { IDataRepository } from '../../repository.ts';
import type {
  CognitiveLevel,
  DifficultyLevel,
  FullQuestion,
  MatchingPairItem,
  QuestionType,
  QuestionUsageStatus,
} from '../../../types/arena.ts';
import {
  ApiValidationError,
  requireIntInRange,
  requireNonEmptyString,
} from '../../middleware/validation.ts';
import {
  QuestionImportExportService,
  SmartAiQuestionService,
} from './smartQuestionService.ts';

const VALID_QUESTION_TYPES: QuestionType[] = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'FILL_IN_BLANK',
  'SHORT_ANSWER',
  'MATCHING',
  'ORDERING',
  'IMAGE_CHOICE',
  'IMAGE_RECOGNITION',
  'AUDIO_QUESTION',
  'VIDEO_QUESTION',
  'ESSAY',
];

const VALID_COGNITIVE: CognitiveLevel[] = ['REMEMBER', 'UNDERSTAND', 'APPLY', 'HIGH_APPLY'];
const VALID_DIFFICULTY: DifficultyLevel[] = ['EASY', 'MEDIUM', 'HARD', 'VERY_HARD'];
const VALID_STATUS: QuestionUsageStatus[] = ['ACTIVE', 'DRAFT', 'ARCHIVED'];

function sanitizeMediaUrl(u: unknown): string | undefined {
  if (typeof u !== 'string' || !u.trim()) return undefined;
  const trimmed = u.trim();
  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/src/assets/') ||
    trimmed.startsWith('data:image/')
  ) {
    return trimmed.slice(0, 150000);
  }
  return undefined;
}

function validateAndNormalizeQuestionInput(
  body: any,
  fallbackSubject = 'Tổng hợp',
  fallbackGrade = 'Khối 12'
): {
  questionType: QuestionType;
  prompt: string;
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  options: string[];
  correctIndex: number;
  correctIndices: number[];
  correctAnswerText: string;
  matchingPairs: MatchingPairItem[];
  orderingItems: string[];
  explanation: string;
  educationLevel: string;
  gradeLevel: string;
  subject: string;
  topic: string;
  lesson: string;
  cognitiveLevel: CognitiveLevel;
  difficulty: DifficultyLevel;
  timeLimitSec: number;
  points: number;
  usageStatus: QuestionUsageStatus;
} {
  const validPrompt = requireNonEmptyString(body?.prompt, 'Nội dung câu hỏi', 4, 2000);
  const qType: QuestionType = VALID_QUESTION_TYPES.includes(body?.questionType)
    ? body.questionType
    : 'SINGLE_CHOICE';

  let cleanOpts: string[] = [];
  let cIndices: number[] = [0];
  let correctAnswerText = typeof body?.correctAnswerText === 'string' ? body.correctAnswerText.trim() : '';
  let matchingPairs: MatchingPairItem[] = Array.isArray(body?.matchingPairs)
    ? body.matchingPairs
        .map((p: any) => ({
          left: String(p?.left || '').trim(),
          right: String(p?.right || '').trim(),
        }))
        .filter((p: MatchingPairItem) => p.left && p.right)
    : [];
  let orderingItems: string[] = Array.isArray(body?.orderingItems)
    ? body.orderingItems.map((i: any) => String(i || '').trim()).filter(Boolean)
    : [];

  if (qType === 'TRUE_FALSE') {
    cleanOpts = ['Đúng', 'Sai'];
    const cIdx = Number(body?.correctIndex) === 1 ? 1 : 0;
    cIndices = [cIdx];
    correctAnswerText = cleanOpts[cIdx];
  } else if (
    qType === 'SINGLE_CHOICE' ||
    qType === 'MULTIPLE_CHOICE' ||
    qType === 'IMAGE_CHOICE' ||
    qType === 'IMAGE_RECOGNITION' ||
    qType === 'AUDIO_QUESTION' ||
    qType === 'VIDEO_QUESTION'
  ) {
    const rawOpts = Array.isArray(body?.options) ? body.options : [];
    cleanOpts = rawOpts.map((o: any) => String(o ?? '').trim()).filter(Boolean);
    if (cleanOpts.length < 2 || cleanOpts.length > 6) {
      throw new ApiValidationError('Vui lòng nhập từ 2 đến 6 phương án trả lời cho câu hỏi trắc nghiệm.');
    }
    const maxOptIdx = cleanOpts.length - 1;
    const cIdx = requireIntInRange(body?.correctIndex ?? 0, 'Đáp án đúng', 0, maxOptIdx);
    cIndices = [cIdx];

    if (qType === 'MULTIPLE_CHOICE' && Array.isArray(body?.correctIndices)) {
      const validMulti: number[] = (body.correctIndices as unknown[])
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= maxOptIdx);
      if (validMulti.length === 0) {
        throw new ApiValidationError('Câu hỏi nhiều đáp án phải chọn ít nhất 1 phương án đúng.');
      }
      cIndices = Array.from(new Set<number>(validMulti)).sort((a, b) => a - b);
    }
    correctAnswerText = cIndices.map((idx) => cleanOpts[idx]).join('; ');
  } else if (qType === 'FILL_IN_BLANK' || qType === 'SHORT_ANSWER') {
    if (!correctAnswerText && Array.isArray(body?.options) && body.options[0]) {
      correctAnswerText = String(body.options[0]).trim();
    }
    if (!correctAnswerText) {
      throw new ApiValidationError('Vui lòng nhập đáp án chuẩn cho câu hỏi Điền từ / Trả lời ngắn.');
    }
    cleanOpts = Array.isArray(body?.options)
      ? body.options.map((o: any) => String(o || '').trim()).filter(Boolean)
      : [];
  } else if (qType === 'MATCHING') {
    if (matchingPairs.length < 2) {
      throw new ApiValidationError('Câu hỏi Ghép đôi cần ít nhất 2 cặp tương ứng.');
    }
    correctAnswerText = matchingPairs.map((p) => `${p.left} -> ${p.right}`).join(' | ');
  } else if (qType === 'ORDERING') {
    if (orderingItems.length < 2 && Array.isArray(body?.options) && body.options.length >= 2) {
      orderingItems = body.options.map((o: any) => String(o || '').trim()).filter(Boolean);
    }
    if (orderingItems.length < 2) {
      throw new ApiValidationError('Câu hỏi Sắp xếp thứ tự cần ít nhất 2 mục.');
    }
    cleanOpts = orderingItems;
    correctAnswerText = orderingItems.join(' -> ');
  } else if (qType === 'ESSAY') {
    cleanOpts = [];
  }

  const cognitiveLevel: CognitiveLevel = VALID_COGNITIVE.includes(body?.cognitiveLevel)
    ? body.cognitiveLevel
    : 'REMEMBER';
  const difficulty: DifficultyLevel = VALID_DIFFICULTY.includes(body?.difficulty)
    ? body.difficulty
    : 'MEDIUM';
  const usageStatus: QuestionUsageStatus = VALID_STATUS.includes(body?.usageStatus)
    ? body.usageStatus
    : 'ACTIVE';

  return {
    questionType: qType,
    prompt: validPrompt,
    imageUrl: sanitizeMediaUrl(body?.imageUrl),
    audioUrl: sanitizeMediaUrl(body?.audioUrl),
    videoUrl: sanitizeMediaUrl(body?.videoUrl),
    options: cleanOpts,
    correctIndex: cIndices[0] ?? 0,
    correctIndices: cIndices,
    correctAnswerText,
    matchingPairs,
    orderingItems,
    explanation: typeof body?.explanation === 'string' ? body.explanation.trim().slice(0, 1200) : '',
    educationLevel:
      typeof body?.educationLevel === 'string' && body.educationLevel.trim()
        ? body.educationLevel.trim()
        : 'THPT',
    gradeLevel:
      typeof body?.gradeLevel === 'string' && body.gradeLevel.trim()
        ? body.gradeLevel.trim()
        : fallbackGrade,
    subject:
      typeof body?.subject === 'string' && body.subject.trim()
        ? body.subject.trim()
        : fallbackSubject,
    topic:
      typeof body?.topic === 'string' && body.topic.trim() ? body.topic.trim() : 'Chuyên đề chung',
    lesson: typeof body?.lesson === 'string' ? body.lesson.trim() : '',
    cognitiveLevel,
    difficulty,
    timeLimitSec: Math.min(300, Math.max(5, Number(body?.timeLimitSec) || 20)),
    points: Math.min(10000, Math.max(100, Number(body?.points) || 1000)),
    usageStatus,
  };
}

/**
 * Modules: Smart Question Bank, Quiz Matrix Builder, Import/Export & AI Assistant
 * (src/server/modules/questions/questionsRouter.ts)
 */
export function createQuestionsAndQuizRouter(
  repo: IDataRepository,
  requireAuth: any,
  requireRole: any
): Router {
  const router = Router();
  const aiService = new SmartAiQuestionService();
  const importExportService = new QuestionImportExportService();

  // ==========================================================================
  // 1. MULTI-LEVEL CATEGORIES (Section IV)
  // ==========================================================================
  router.get('/question-categories', requireAuth, (_req: AuthenticatedRequest, res) => {
    const categories = repo.listCategories().map((c) => ({
      ...c,
      name: c.name || `${c.subject} - ${c.topic}`,
    }));
    res.json({ categories });
  });

  router.post(
    '/question-categories',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const { name, educationLevel, gradeLevel, subject, topic, lesson } = req.body || {};
        const validName = requireNonEmptyString(name || topic, 'Tên danh mục', 2, 150);
        const category = repo.createCategory({
          educationLevel:
            typeof educationLevel === 'string' && educationLevel.trim()
              ? educationLevel.trim()
              : 'THPT',
          gradeLevel:
            typeof gradeLevel === 'string' && gradeLevel.trim() ? gradeLevel.trim() : 'Khối 12',
          subject: typeof subject === 'string' && subject.trim() ? subject.trim() : 'Tổng hợp',
          topic: typeof topic === 'string' && topic.trim() ? topic.trim() : validName,
          lesson: typeof lesson === 'string' ? lesson.trim() : '',
          creatorId: req.user!.id,
        });
        res.status(201).json({
          category: {
            ...category,
            name: validName,
          },
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.delete(
    '/question-categories/:id',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res) => {
      repo.deleteCategory(req.params.id);
      res.json({ deleted: true });
    }
  );

  // ==========================================================================
  // 2. QUESTION SETS (QUIZ SETS), SHARING, MATRIX & ORDERING (Section V)
  // ==========================================================================
  router.get('/question-sets', requireAuth, (req: AuthenticatedRequest, res) => {
    const allSets = repo.listQuestionSets().filter((s) => s.id !== 'qset_general_archive');
    const visibleSets =
      req.user!.role === 'ADMIN'
        ? allSets
        : allSets.filter(
            (s) =>
              s.isPublic ||
              s.creatorId === req.user!.id ||
              (Array.isArray(s.sharedWithIds) && s.sharedWithIds.includes(req.user!.id))
          );
    res.json({ questionSets: visibleSets });
  });

  router.get('/quizzes', requireAuth, (_req: AuthenticatedRequest, res) => {
    const quizzes = repo.listQuestionSets().filter((s) => s.id !== 'qset_general_archive');
    res.json({ quizzes, questionSets: quizzes });
  });

  router.post(
    '/question-sets',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const {
          title,
          subject,
          gradeLevel,
          topic,
          description,
          isPublic,
          defaultTimeLimitSec,
          defaultPoints,
          sharedWithIds,
        } = req.body || {};
        const validTitle = requireNonEmptyString(title, 'Tên bộ câu hỏi', 3, 200);

        const created = repo.createQuestionSet({
          title: validTitle,
          subject: typeof subject === 'string' && subject.trim() ? subject.trim() : 'Tổng hợp',
          gradeLevel:
            typeof gradeLevel === 'string' && gradeLevel.trim() ? gradeLevel.trim() : 'Khối 12',
          topic: typeof topic === 'string' ? topic.trim() : '',
          description: typeof description === 'string' ? description.slice(0, 500) : '',
          creatorId: req.user!.id,
          isPublic: isPublic !== false,
          defaultTimeLimitSec: Number(defaultTimeLimitSec) || 20,
          defaultPoints: Number(defaultPoints) || 1000,
          sharedWithIds: Array.isArray(sharedWithIds) ? sharedWithIds.map(String) : [],
        });

        repo.logActivity({
          actorId: req.user!.id,
          actorName: req.user!.fullName,
          actorRole: req.user!.role,
          action: 'QUIZ_CREATED',
          module: 'Quiz',
          targetId: created.id,
          details: `Tạo bộ đề "${created.title}" (${created.subject})`,
        });

        res.status(201).json({ questionSet: created });
      } catch (err) {
        next(err);
      }
    }
  );

  router.put(
    '/question-sets/:id',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const qSet = repo.getQuestionSetById(req.params.id);
        if (!qSet) {
          throw new ApiValidationError('Không tìm thấy bộ câu hỏi.', 404);
        }
        if (
          req.user!.role !== 'ADMIN' &&
          qSet.creatorId !== req.user!.id &&
          qSet.creatorId !== 'usr_teacher_demo'
        ) {
          throw new ApiValidationError('Bạn chỉ có quyền chỉnh sửa bộ đề do mình tạo.', 403);
        }

        const updated = repo.updateQuestionSet(qSet.id, {
          title: typeof req.body?.title === 'string' ? req.body.title.trim() : undefined,
          subject: typeof req.body?.subject === 'string' ? req.body.subject.trim() : undefined,
          gradeLevel:
            typeof req.body?.gradeLevel === 'string' ? req.body.gradeLevel.trim() : undefined,
          topic: typeof req.body?.topic === 'string' ? req.body.topic.trim() : undefined,
          description:
            typeof req.body?.description === 'string' ? req.body.description.trim() : undefined,
          isPublic: typeof req.body?.isPublic === 'boolean' ? req.body.isPublic : undefined,
          defaultTimeLimitSec: req.body?.defaultTimeLimitSec
            ? Number(req.body.defaultTimeLimitSec)
            : undefined,
          defaultPoints: req.body?.defaultPoints ? Number(req.body.defaultPoints) : undefined,
          sharedWithIds: Array.isArray(req.body?.sharedWithIds)
            ? req.body.sharedWithIds.map(String)
            : undefined,
        });

        res.json({ questionSet: updated });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/question-sets/:id/duplicate',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        let duplicated = repo.duplicateQuestionSet(req.params.id, req.user!);
        if (!duplicated) {
          throw new ApiValidationError('Không tìm thấy bộ câu hỏi để nhân bản.', 404);
        }
        if (typeof req.body?.newTitle === 'string' && req.body.newTitle.trim()) {
          const renamed = repo.updateQuestionSet(duplicated.id, {
            title: req.body.newTitle.trim(),
          });
          if (renamed) duplicated = renamed;
        }
        repo.logActivity({
          actorId: req.user!.id,
          actorName: req.user!.fullName,
          actorRole: req.user!.role,
          action: 'QUIZ_DUPLICATED',
          module: 'Quiz',
          targetId: duplicated.id,
          details: `Nhân bản bộ đề "${duplicated.title}"`,
        });
        res.status(201).json({ questionSet: duplicated });
      } catch (err) {
        next(err);
      }
    }
  );

  router.put(
    '/question-sets/:id/reorder',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const qSet = repo.getQuestionSetById(req.params.id);
        if (!qSet) {
          throw new ApiValidationError('Không tìm thấy bộ câu hỏi.', 404);
        }
        const orderedIds = Array.isArray(req.body?.orderedQuestionIds)
          ? req.body.orderedQuestionIds.map(String)
          : [];
        repo.reorderQuestionsInSet(qSet.id, orderedIds);
        const questions = repo.getQuestionsForSet(qSet.id);
        res.json({ questions });
      } catch (err) {
        next(err);
      }
    }
  );

  router.delete(
    '/question-sets/:id/questions/:questionId',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const qSet = repo.getQuestionSetById(req.params.id);
        if (!qSet) {
          throw new ApiValidationError('Không tìm thấy bộ câu hỏi.', 404);
        }
        repo.removeQuestionFromSet(qSet.id, req.params.questionId);
        res.json({ removedFromSet: true, preservedInBank: true });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/question-sets/:id/assign-questions',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const qSet = repo.getQuestionSetById(req.params.id);
        if (!qSet) {
          throw new ApiValidationError('Không tìm thấy bộ đề đích.', 404);
        }
        const questionIds: string[] = Array.isArray(req.body?.questionIds)
          ? req.body.questionIds.map(String)
          : [];
        const added: FullQuestion[] = [];

        for (const qId of questionIds) {
          const existing = repo.getQuestionById(qId);
          if (!existing) continue;
          const cloned = repo.duplicateQuestion(qId, qSet.id, req.user!);
          if (cloned) added.push(cloned);
        }

        res.json({
          addedCount: added.length,
          questions: repo.getQuestionsForSet(qSet.id),
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/question-sets/:id/auto-matrix',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const qSet = repo.getQuestionSetById(req.params.id);
        if (!qSet) {
          throw new ApiValidationError('Không tìm thấy bộ đề.', 404);
        }
        const {
          subject,
          gradeLevel,
          topic,
          arenaOnly,
          cognitiveCounts,
          difficultyCounts,
          applyToSet,
        } = req.body || {};

        const selected = repo.autoSelectQuestionsByMatrix({
          subject: typeof subject === 'string' && subject ? subject : undefined,
          gradeLevel: typeof gradeLevel === 'string' && gradeLevel ? gradeLevel : undefined,
          topic: typeof topic === 'string' && topic ? topic : undefined,
          arenaOnly: Boolean(arenaOnly),
          matrix: {
            rememberCount: Number(cognitiveCounts?.REMEMBER) || 0,
            understandCount: Number(cognitiveCounts?.UNDERSTAND) || 0,
            applyCount: Number(cognitiveCounts?.APPLY) || 0,
            highApplyCount: Number(cognitiveCounts?.HIGH_APPLY) || 0,
            easyCount: Number(difficultyCounts?.EASY) || 0,
            mediumCount: Number(difficultyCounts?.MEDIUM) || 0,
            hardCount: Number(difficultyCounts?.HARD) || 0,
            veryHardCount: Number(difficultyCounts?.VERY_HARD) || 0,
          },
        });

        let addedCount = 0;
        if (applyToSet && selected.length > 0) {
          for (const q of selected) {
            if (q.questionSetId === qSet.id) continue;
            const cloned = repo.duplicateQuestion(q.id, qSet.id, req.user!);
            if (cloned) addedCount++;
          }
        }

        res.json({
          previewQuestions: selected,
          totalSelected: selected.length,
          applied: Boolean(applyToSet),
          addedCount,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.delete(
    '/question-sets/:id',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const qSet = repo.getQuestionSetById(req.params.id);
        if (!qSet) {
          throw new ApiValidationError('Không tìm thấy bộ câu hỏi.', 404);
        }
        if (
          req.user!.role !== 'ADMIN' &&
          qSet.creatorId !== req.user!.id &&
          qSet.creatorId !== 'usr_teacher_demo'
        ) {
          throw new ApiValidationError('Bạn chỉ có thể xóa bộ câu hỏi do chính mình tạo.', 403);
        }
        repo.deleteQuestionSet(qSet.id);
        res.json({ deleted: true });
      } catch (err) {
        next(err);
      }
    }
  );

  // ==========================================================================
  // 3. QUESTION BANK CRUD, SEARCH & MULTI-CRITERIA FILTER (Section II & III)
  // ==========================================================================
  router.get(
    '/questions',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res) => {
      const qTypeParam =
        typeof req.query.questionType === 'string' &&
        VALID_QUESTION_TYPES.includes(req.query.questionType as QuestionType)
          ? (req.query.questionType as QuestionType)
          : undefined;
      const cogParam =
        typeof req.query.cognitiveLevel === 'string' &&
        VALID_COGNITIVE.includes(req.query.cognitiveLevel as CognitiveLevel)
          ? (req.query.cognitiveLevel as CognitiveLevel)
          : undefined;
      const diffParam =
        typeof req.query.difficulty === 'string' &&
        VALID_DIFFICULTY.includes(req.query.difficulty as DifficultyLevel)
          ? (req.query.difficulty as DifficultyLevel)
          : undefined;
      const statusParam =
        typeof req.query.usageStatus === 'string' &&
        VALID_STATUS.includes(req.query.usageStatus as QuestionUsageStatus)
          ? (req.query.usageStatus as QuestionUsageStatus)
          : undefined;

      const questions = repo.listAllQuestions({
        questionSetId:
          typeof req.query.questionSetId === 'string' ? req.query.questionSetId : undefined,
        subject: typeof req.query.subject === 'string' ? req.query.subject : undefined,
        gradeLevel: typeof req.query.gradeLevel === 'string' ? req.query.gradeLevel : undefined,
        educationLevel:
          typeof req.query.educationLevel === 'string' ? req.query.educationLevel : undefined,
        topic: typeof req.query.topic === 'string' ? req.query.topic : undefined,
        questionType: qTypeParam,
        cognitiveLevel: cogParam,
        difficulty: diffParam,
        usageStatus: statusParam,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
      });
      res.json({ questions });
    }
  );

  router.get(
    '/question-sets/:id/questions',
    requireAuth,
    (req: AuthenticatedRequest, res, next) => {
      try {
        const qSet = repo.getQuestionSetById(req.params.id);
        if (!qSet) {
          throw new ApiValidationError('Không tìm thấy bộ câu hỏi.', 404);
        }
        const fullQuestions = repo.getQuestionsForSet(qSet.id);

        // SECURITY RULE (Section XIII): Never send correct answers to STUDENT role from Question Bank API
        if (req.user!.role === 'STUDENT') {
          const sanitized = fullQuestions.map(
            ({
              correctIndex: _c,
              correctIndices: _ci,
              correctAnswerText: _ct,
              matchingPairs: _mp,
              orderingItems: _oi,
              explanation: _e,
              ...pub
            }) => pub
          );
          res.json({ questionSet: qSet, questions: sanitized, answersMasked: true });
          return;
        }

        res.json({ questionSet: qSet, questions: fullQuestions, answersMasked: false });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/question-sets/:id/questions',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const qSet = repo.getQuestionSetById(req.params.id);
        if (!qSet) {
          throw new ApiValidationError('Không tìm thấy bộ câu hỏi.', 404);
        }

        const normalized = validateAndNormalizeQuestionInput(
          req.body,
          qSet.subject,
          qSet.gradeLevel
        );

        const question = repo.addQuestionToSet({
          questionSetId: qSet.id,
          ...normalized,
          creatorId: req.user!.id,
        });

        repo.logActivity({
          actorId: req.user!.id,
          actorName: req.user!.fullName,
          actorRole: req.user!.role,
          action: 'QUESTION_ADDED',
          module: 'Questions',
          targetId: question.id,
          details: `Thêm câu hỏi ${question.questionCode} (${question.questionType}) vào "${qSet.title}"`,
        });

        res.status(201).json({ question });
      } catch (err) {
        next(err);
      }
    }
  );

  router.put(
    '/questions/:id',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const existing = repo.getQuestionById(req.params.id);
        if (!existing) {
          throw new ApiValidationError('Không tìm thấy câu hỏi.', 404);
        }
        if (
          req.user!.role !== 'ADMIN' &&
          existing.creatorId &&
          existing.creatorId !== req.user!.id &&
          existing.creatorId !== 'usr_teacher_demo'
        ) {
          throw new ApiValidationError('Bạn chỉ có quyền chỉnh sửa câu hỏi do mình biên soạn.', 403);
        }

        const normalized = validateAndNormalizeQuestionInput(
          { ...existing, ...req.body },
          existing.subject,
          existing.gradeLevel
        );

        const updated = repo.updateQuestion(existing.id, {
          ...normalized,
        });

        res.json({ question: updated });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/questions/:id/duplicate',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const existing = repo.getQuestionById(req.params.id);
        if (!existing) {
          throw new ApiValidationError('Không tìm thấy câu hỏi để sao chép.', 404);
        }
        const targetSetId =
          typeof req.body?.targetSetId === 'string' && req.body.targetSetId
            ? req.body.targetSetId
            : existing.questionSetId;
        const duplicated = repo.duplicateQuestion(req.params.id, targetSetId, req.user!);
        if (!duplicated) {
          throw new ApiValidationError('Không tìm thấy câu hỏi để sao chép.', 404);
        }
        res.status(201).json({ question: duplicated });
      } catch (err) {
        next(err);
      }
    }
  );

  router.delete(
    '/questions/:id',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const existing = repo.getQuestionById(req.params.id);
        if (!existing) {
          res.json({ deleted: true });
          return;
        }
        if (
          req.user!.role !== 'ADMIN' &&
          existing.creatorId &&
          existing.creatorId !== req.user!.id &&
          existing.creatorId !== 'usr_teacher_demo'
        ) {
          throw new ApiValidationError('Bạn chỉ có quyền xóa câu hỏi do chính mình tạo.', 403);
        }
        repo.deleteQuestion(req.params.id);
        res.json({ deleted: true });
      } catch (err) {
        next(err);
      }
    }
  );

  // ==========================================================================
  // 4. BULK IMPORT & EXPORT (WORD .DOCX, EXCEL .XLSX/.XLS, CSV, JSON)
  // ==========================================================================
  router.get(
    '/questions/import/template',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res) => {
      const format = String(req.query.format || 'XLSX').toUpperCase() === 'CSV' ? 'CSV' : 'XLSX';
      const template = importExportService.generateImportTemplate(format);
      res.json(template);
    }
  );

  router.post(
    '/questions/import/preview',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const {
          fileName,
          fileBase64,
          questionSetId,
          defaultSubject,
          defaultGradeLevel,
          columnMapping,
        } = req.body || {};

        const existingList = questionSetId
          ? repo.getQuestionsForSet(String(questionSetId))
          : repo.listAllQuestions();
        const existingPrompts = new Set(
          existingList.map((q) => q.prompt.trim().toLowerCase().replace(/\s+/g, ' '))
        );

        const preview = await importExportService.parseImportFile({
          fileName: String(fileName || 'questions.xlsx'),
          fileBase64: String(fileBase64 || ''),
          existingPrompts,
          defaultSubject: typeof defaultSubject === 'string' ? defaultSubject : 'Tổng hợp',
          defaultGradeLevel: typeof defaultGradeLevel === 'string' ? defaultGradeLevel : 'Khối 12',
          columnMapping:
            columnMapping && typeof columnMapping === 'object' ? columnMapping : undefined,
        });

        res.json({ preview });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/questions/import/commit',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const { questionSetId, rows, skipDuplicates, skipInvalid } = req.body || {};
        const qSet = repo.getQuestionSetById(String(questionSetId || ''));
        if (!qSet) {
          throw new ApiValidationError('Vui lòng chọn bộ đề đích để lưu câu hỏi nhập khẩu.', 400);
        }
        if (!Array.isArray(rows) || rows.length === 0) {
          throw new ApiValidationError('Không có dòng dữ liệu câu hỏi nào để lưu.', 400);
        }

        const existingPrompts = new Set(
          repo
            .getQuestionsForSet(qSet.id)
            .map((q) => q.prompt.trim().toLowerCase().replace(/\s+/g, ' '))
        );

        const imported: FullQuestion[] = [];
        let skippedInvalidCount = 0;
        let skippedDuplicateCount = 0;

        for (const row of rows) {
          const normPrompt = String(row?.prompt || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
          if (skipDuplicates && existingPrompts.has(normPrompt)) {
            skippedDuplicateCount++;
            continue;
          }
          try {
            const normalized = validateAndNormalizeQuestionInput(
              row,
              qSet.subject,
              qSet.gradeLevel
            );
            const created = repo.addQuestionToSet({
              questionSetId: qSet.id,
              ...normalized,
              creatorId: req.user!.id,
            });
            imported.push(created);
            existingPrompts.add(normPrompt);
          } catch (err) {
            if (skipInvalid !== false) {
              skippedInvalidCount++;
            } else {
              throw err;
            }
          }
        }

        repo.logActivity({
          actorId: req.user!.id,
          actorName: req.user!.fullName,
          actorRole: req.user!.role,
          action: 'QUESTIONS_IMPORTED',
          module: 'Questions',
          targetId: qSet.id,
          details: `Nhập hàng loạt ${imported.length} câu hỏi vào bộ đề "${qSet.title}"`,
        });

        res.status(201).json({
          importedCount: imported.length,
          skippedInvalidCount,
          skippedDuplicateCount,
          questions: imported,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/questions/export',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const { questionSetId, questionIds, format, includeAnswers } = req.body || {};
        let targetQuestions: FullQuestion[] = [];
        let exportTitle = 'Ngan_Hang_Cau_Hoi_Quizzi';

        if (Array.isArray(questionIds) && questionIds.length > 0) {
          const idSet = new Set(questionIds.map(String));
          targetQuestions = repo.listAllQuestions().filter((q) => idSet.has(q.id));
          exportTitle = `Cau_Hoi_Da_Chon_${targetQuestions.length}`;
        } else if (typeof questionSetId === 'string' && questionSetId) {
          const qSet = repo.getQuestionSetById(questionSetId);
          if (!qSet) {
            throw new ApiValidationError('Không tìm thấy bộ câu hỏi cần xuất.', 404);
          }
          targetQuestions = repo.getQuestionsForSet(qSet.id);
          exportTitle = qSet.title;
        } else {
          targetQuestions = repo.listAllQuestions();
        }

        if (targetQuestions.length === 0) {
          throw new ApiValidationError('Không có câu hỏi nào để xuất tệp.', 400);
        }

        const fmtUpper = String(format || 'XLSX').toUpperCase();
        const validFormat: 'XLSX' | 'CSV' | 'DOCX' | 'JSON' =
          fmtUpper === 'CSV' || fmtUpper === 'DOCX' || fmtUpper === 'JSON' ? fmtUpper : 'XLSX';

        const result = importExportService.exportQuestions({
          questions: targetQuestions,
          format: validFormat,
          includeAnswers: includeAnswers !== false,
          title: exportTitle,
        });

        res.json({ exportResult: result });
      } catch (err) {
        next(err);
      }
    }
  );

  // ==========================================================================
  // 5. QUESTION QUALITY CHECKER & AI ASSISTANT (Section VIII, IX, X, XI, XII)
  // ==========================================================================
  router.get(
    '/questions/quality-check',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (req: AuthenticatedRequest, res) => {
      const questionSetId =
        typeof req.query.questionSetId === 'string' && req.query.questionSetId
          ? req.query.questionSetId
          : undefined;
      const issues = repo.analyzeQuestionBankQuality({ questionSetId });
      res.json({
        totalIssues: issues.length,
        errorCount: issues.filter((i) => i.severity === 'ERROR').length,
        warningCount: issues.filter((i) => i.severity === 'WARNING').length,
        issues,
      });
    }
  );

  router.get(
    '/ai/status',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    (_req: AuthenticatedRequest, res) => {
      res.json({ status: aiService.getStatus() });
    }
  );

  router.post(
    '/ai/generate-prompt',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const {
          subject,
          gradeLevel,
          educationLevel,
          topic,
          lesson,
          questionType,
          cognitiveLevel,
          difficulty,
          count,
          additionalInstructions,
        } = req.body || {};

        const validTopic = requireNonEmptyString(topic, 'Chủ đề / Nội dung yêu cầu', 2, 300);
        const result = await aiService.generateFromPrompt({
          subject: typeof subject === 'string' && subject ? subject : 'Tổng hợp',
          gradeLevel: typeof gradeLevel === 'string' && gradeLevel ? gradeLevel : 'Khối 12',
          educationLevel:
            typeof educationLevel === 'string' && educationLevel ? educationLevel : 'THPT',
          topic: validTopic,
          lesson: typeof lesson === 'string' ? lesson : '',
          questionType: VALID_QUESTION_TYPES.includes(questionType)
            ? questionType
            : 'SINGLE_CHOICE',
          cognitiveLevel: VALID_COGNITIVE.includes(cognitiveLevel) ? cognitiveLevel : 'UNDERSTAND',
          difficulty: VALID_DIFFICULTY.includes(difficulty) ? difficulty : 'MEDIUM',
          count: Math.min(15, Math.max(1, Number(count) || 5)),
          additionalInstructions:
            typeof additionalInstructions === 'string' ? additionalInstructions : undefined,
        });

        res.json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/ai/generate-document',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const {
          fileName,
          fileType,
          fileBase64,
          rawText,
          subject,
          gradeLevel,
          topic,
          questionType,
          cognitiveLevel,
          difficulty,
          count,
        } = req.body || {};

        const result = await aiService.generateFromDocument({
          fileName: typeof fileName === 'string' ? fileName : undefined,
          fileType: fileType || undefined,
          fileBase64: typeof fileBase64 === 'string' ? fileBase64 : undefined,
          rawText: typeof rawText === 'string' ? rawText : undefined,
          subject: typeof subject === 'string' && subject ? subject : 'Tổng hợp',
          gradeLevel: typeof gradeLevel === 'string' && gradeLevel ? gradeLevel : 'Khối 12',
          topic: typeof topic === 'string' ? topic : undefined,
          questionType: VALID_QUESTION_TYPES.includes(questionType)
            ? questionType
            : 'SINGLE_CHOICE',
          cognitiveLevel: VALID_COGNITIVE.includes(cognitiveLevel) ? cognitiveLevel : 'UNDERSTAND',
          difficulty: VALID_DIFFICULTY.includes(difficulty) ? difficulty : 'MEDIUM',
          count: Math.min(15, Math.max(1, Number(count) || 5)),
        });

        res.json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    '/ai/generate-image',
    requireAuth,
    requireRole(['ADMIN', 'TEACHER']),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const { mimeType, imageBase64, subject, gradeLevel, topic, count, teacherPrompt } =
          req.body || {};

        const result = await aiService.generateFromImage({
          mimeType: typeof mimeType === 'string' && mimeType ? mimeType : 'image/png',
          imageBase64: String(imageBase64 || ''),
          subject: typeof subject === 'string' && subject ? subject : 'Khoa học',
          gradeLevel: typeof gradeLevel === 'string' && gradeLevel ? gradeLevel : 'Khối 12',
          topic: typeof topic === 'string' ? topic : undefined,
          count: Math.min(10, Math.max(1, Number(count) || 3)),
          teacherPrompt: typeof teacherPrompt === 'string' ? teacherPrompt : undefined,
        });

        res.json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
