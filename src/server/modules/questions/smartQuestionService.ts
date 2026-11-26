import { GoogleGenAI, Type } from '@google/genai';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import type {
  AiProviderStatus,
  CognitiveLevel,
  DifficultyLevel,
  FullQuestion,
  GeneratedDraftQuestion,
  MatchingPairItem,
  QuestionType,
} from '../../../types/arena.ts';
import { ApiValidationError } from '../../middleware/validation.ts';

export interface ImportPreviewRow {
  rowIndex: number;
  prompt: string;
  questionType: QuestionType;
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
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  isValid: boolean;
  isDuplicate: boolean;
  errors: string[];
  warnings: string[];
}

export interface ImportPreviewResult {
  fileName: string;
  format: 'XLSX' | 'CSV' | 'DOCX';
  totalRows: number;
  validCount: number;
  errorCount: number;
  duplicateCount: number;
  detectedColumns: string[];
  rows: ImportPreviewRow[];
}

export interface ExportResultPayload {
  fileName: string;
  mimeType: string;
  format: 'XLSX' | 'CSV' | 'DOCX' | 'JSON';
  includeAnswers: boolean;
  questionCount: number;
  contentBase64?: string;
  contentText?: string;
}

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

const VALID_COGNITIVE_LEVELS: CognitiveLevel[] = [
  'REMEMBER',
  'UNDERSTAND',
  'APPLY',
  'HIGH_APPLY',
];

const VALID_DIFFICULTIES: DifficultyLevel[] = ['EASY', 'MEDIUM', 'HARD', 'VERY_HARD'];

function normalizeQuestionType(raw: unknown): QuestionType {
  const s = String(raw || '').trim().toUpperCase();
  if (VALID_QUESTION_TYPES.includes(s as QuestionType)) return s as QuestionType;
  if (s.includes('NHIỀU') || s.includes('MULTI')) return 'MULTIPLE_CHOICE';
  if (s.includes('ĐÚNG') || s.includes('SAI') || s.includes('TRUE')) return 'TRUE_FALSE';
  if (s.includes('ĐIỀN') || s.includes('BLANK')) return 'FILL_IN_BLANK';
  if (s.includes('NGẮN') || s.includes('SHORT')) return 'SHORT_ANSWER';
  if (s.includes('GHÉP') || s.includes('MATCH')) return 'MATCHING';
  if (s.includes('SẮP XẾP') || s.includes('ORDER')) return 'ORDERING';
  if (s.includes('TỰ LUẬN') || s.includes('ESSAY')) return 'ESSAY';
  if (s.includes('ẢNH') || s.includes('IMAGE')) return 'IMAGE_RECOGNITION';
  if (s.includes('ÂM THANH') || s.includes('AUDIO')) return 'AUDIO_QUESTION';
  if (s.includes('VIDEO')) return 'VIDEO_QUESTION';
  return 'SINGLE_CHOICE';
}

function normalizeCognitive(raw: unknown): CognitiveLevel {
  const s = String(raw || '').trim().toUpperCase();
  if (VALID_COGNITIVE_LEVELS.includes(s as CognitiveLevel)) return s as CognitiveLevel;
  if (s.includes('VẬN DỤNG CAO') || s.includes('HIGH')) return 'HIGH_APPLY';
  if (s.includes('VẬN DỤNG') || s.includes('APPLY')) return 'APPLY';
  if (s.includes('THÔNG HIỂU') || s.includes('UNDERSTAND')) return 'UNDERSTAND';
  return 'REMEMBER';
}

function normalizeDifficulty(raw: unknown): DifficultyLevel {
  const s = String(raw || '').trim().toUpperCase();
  if (VALID_DIFFICULTIES.includes(s as DifficultyLevel)) return s as DifficultyLevel;
  if (s.includes('RẤT KHÓ') || s.includes('VERY_HARD')) return 'VERY_HARD';
  if (s.includes('KHÓ') || s.includes('HARD')) return 'HARD';
  if (s.includes('DỄ') || s.includes('EASY')) return 'EASY';
  return 'MEDIUM';
}

function parseAnswerIndices(rawAnswer: unknown, options: string[], qType: QuestionType): {
  correctIndex: number;
  correctIndices: number[];
  correctAnswerText: string;
} {
  const str = String(rawAnswer ?? '').trim();
  if (!str) {
    return { correctIndex: 0, correctIndices: [0], correctAnswerText: options[0] || '' };
  }

  if (qType === 'TRUE_FALSE') {
    const upper = str.toUpperCase();
    const isFalse =
      upper === 'B' ||
      upper === '2' ||
      upper === '1' ||
      upper.includes('SAI') ||
      upper === 'FALSE' ||
      upper === 'F';
    const isTrue =
      upper === 'A' ||
      upper === '0' ||
      upper.includes('ĐÚNG') ||
      upper === 'TRUE' ||
      upper === 'T';
    const idx = isFalse && !isTrue ? 1 : 0;
    return { correctIndex: idx, correctIndices: [idx], correctAnswerText: idx === 0 ? 'Đúng' : 'Sai' };
  }

  if (qType === 'FILL_IN_BLANK' || qType === 'SHORT_ANSWER' || qType === 'ESSAY') {
    return {
      correctIndex: 0,
      correctIndices: [0],
      correctAnswerText: str,
    };
  }

  // Handle letter answers: "A", "B", "C", "D" or "A, C" or "1, 3"
  const parts = str
    .split(/[,;|/]/)
    .map((p) => p.trim())
    .filter(Boolean);
  const indices: number[] = [];

  for (const part of parts) {
    const upper = part.toUpperCase();
    if (upper === 'A') indices.push(0);
    else if (upper === 'B') indices.push(1);
    else if (upper === 'C') indices.push(2);
    else if (upper === 'D') indices.push(3);
    else if (/^\d+$/.test(upper)) {
      const num = parseInt(upper, 10);
      // Accept 1-based (1..4) or 0-based (0..3)
      if (num >= 1 && num <= options.length) indices.push(num - 1);
      else if (num >= 0 && num < options.length) indices.push(num);
    } else {
      const foundIdx = options.findIndex(
        (opt) => opt.trim().toLowerCase() === part.toLowerCase()
      );
      if (foundIdx >= 0) indices.push(foundIdx);
    }
  }

  const unique = Array.from(new Set(indices)).filter((i) => i >= 0 && i < Math.max(2, options.length));
  if (unique.length === 0) {
    return { correctIndex: 0, correctIndices: [0], correctAnswerText: str };
  }
  return {
    correctIndex: unique[0],
    correctIndices: qType === 'MULTIPLE_CHOICE' ? unique : [unique[0]],
    correctAnswerText: unique.map((i) => options[i] || '').join('; '),
  };
}

// ============================================================================
// 1. PROVIDER-INDEPENDENT AI ASSISTANT SERVICE (Section VIII, IX, X, XII)
// ============================================================================
export interface IAiQuestionProvider {
  getStatus(): AiProviderStatus;
  generateFromPrompt(params: {
    subject: string;
    gradeLevel: string;
    educationLevel?: string;
    topic: string;
    lesson?: string;
    questionType?: QuestionType;
    cognitiveLevel?: CognitiveLevel;
    difficulty?: DifficultyLevel;
    count: number;
    additionalInstructions?: string;
  }): Promise<{ questions: GeneratedDraftQuestion[]; summary: string; usedFallback: boolean }>;
  generateFromDocument(params: {
    fileName?: string;
    fileType?: 'DOCX' | 'TXT' | 'CSV' | 'RAW_TEXT';
    fileBase64?: string;
    rawText?: string;
    subject: string;
    gradeLevel: string;
    topic?: string;
    questionType?: QuestionType;
    cognitiveLevel?: CognitiveLevel;
    difficulty?: DifficultyLevel;
    count: number;
  }): Promise<{
    questions: GeneratedDraftQuestion[];
    extractedKeyPoints: string[];
    documentLength: number;
    usedFallback: boolean;
    warning?: string;
  }>;
  generateFromImage(params: {
    mimeType: string;
    imageBase64: string;
    subject: string;
    gradeLevel: string;
    topic?: string;
    count: number;
    teacherPrompt?: string;
  }): Promise<{
    questions: GeneratedDraftQuestion[];
    imageAnalysisSummary: string;
    usedFallback: boolean;
  }>;
}

export class SmartAiQuestionService implements IAiQuestionProvider {
  private readonly maxCallsPerMinute = 15;
  private callTimestamps: number[] = [];

  private isApiKeyConfigured(): boolean {
    const key = (process.env.GEMINI_API_KEY || '').trim();
    return Boolean(key && key !== 'MY_GEMINI_API_KEY' && key.length > 10);
  }

  private getRemainingQuota(): number {
    const now = Date.now();
    this.callTimestamps = this.callTimestamps.filter((t) => now - t < 60_000);
    return Math.max(0, this.maxCallsPerMinute - this.callTimestamps.length);
  }

  private consumeQuotaOrThrow(): void {
    const remaining = this.getRemainingQuota();
    if (remaining <= 0) {
      throw new ApiValidationError(
        'Đã đạt giới hạn gọi Trợ lý AI trong 1 phút (tối đa 15 yêu cầu/phút để kiểm soát chi phí). Vui lòng đợi 30 giây rồi thử lại.',
        429
      );
    }
    this.callTimestamps.push(Date.now());
  }

  public getStatus(): AiProviderStatus {
    const configured = this.isApiKeyConfigured();
    const remaining = this.getRemainingQuota();
    const msg = configured
      ? `Trợ lý AI sẵn sàng (${remaining}/${this.maxCallsPerMinute} lượt gọi khả dụng trong phút này).`
      : 'Chế độ AI trực tiếp chưa cấu hình khóa môi trường máy chủ — hệ thống sẽ sử dụng bộ sinh câu hỏi mẫu theo cấu trúc sư phạm hoặc cho phép nhập thủ công 100%.';
    return {
      configured,
      isConfigured: configured,
      providerName: 'Google Gemini Provider-Independent Adapter',
      modelName: 'gemini-4-hydrogen',
      modelAlias: 'gemini-4-hydrogen',
      rateLimitPerMinute: this.maxCallsPerMinute,
      remainingCallsThisMinute: remaining,
      remainingRequestsPerMinute: remaining,
      manualFallbackAvailable: true,
      notice: msg,
      message: msg,
    };
  }

  private createGenAiClient(): GoogleGenAI {
    return new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }

  private getDraftQuestionsSchema() {
    return {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description: 'Tóm tắt ngắn gọn nội dung hoặc kiến thức trọng tâm bằng tiếng Việt.',
        },
        keyPoints: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Danh sách các ý chính rút ra từ chủ đề hoặc tài liệu.',
        },
        questions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              prompt: { type: Type.STRING, description: 'Nội dung câu hỏi rõ ràng bằng tiếng Việt' },
              questionType: {
                type: Type.STRING,
                description:
                  'SINGLE_CHOICE, MULTIPLE_CHOICE, TRUE_FALSE, FILL_IN_BLANK, SHORT_ANSWER, MATCHING, ORDERING, hoặc ESSAY',
              },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Danh sách 4 đáp án (hoặc 2 đáp án Đúng/Sai)',
              },
              correctIndex: {
                type: Type.INTEGER,
                description: 'Chỉ số đáp án đúng (0, 1, 2, hoặc 3)',
              },
              correctIndices: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: 'Danh sách chỉ số đáp án đúng',
              },
              correctAnswerText: {
                type: Type.STRING,
                description: 'Đáp án dạng văn bản cho câu điền từ, trả lời ngắn, hoặc tự luận',
              },
              explanation: {
                type: Type.STRING,
                description: 'Giải thích chi tiết vì sao đáp án đó đúng',
              },
              cognitiveLevel: {
                type: Type.STRING,
                description: 'REMEMBER, UNDERSTAND, APPLY, hoặc HIGH_APPLY',
              },
              difficulty: {
                type: Type.STRING,
                description: 'EASY, MEDIUM, HARD, hoặc VERY_HARD',
              },
            },
            required: [
              'prompt',
              'questionType',
              'options',
              'correctIndex',
              'explanation',
              'cognitiveLevel',
              'difficulty',
            ],
          },
        },
      },
      required: ['summary', 'questions'],
    };
  }

  private sanitizeGeneratedList(
    rawList: any[],
    defaults: {
      subject: string;
      gradeLevel: string;
      educationLevel: string;
      topic: string;
      lesson: string;
      questionType: QuestionType;
      cognitiveLevel: CognitiveLevel;
      difficulty: DifficultyLevel;
    }
  ): GeneratedDraftQuestion[] {
    return (Array.isArray(rawList) ? rawList : []).map((item) => {
      const qType = normalizeQuestionType(item?.questionType || defaults.questionType);
      let opts: string[] = Array.isArray(item?.options)
        ? item.options.map((o: any) => String(o || '').trim()).filter(Boolean)
        : [];
      if (qType === 'TRUE_FALSE') {
        opts = ['Đúng', 'Sai'];
      } else if (opts.length < 2) {
        opts = [
          item?.correctAnswerText || 'Phương án A (Đáp án đúng)',
          'Phương án B (Nhiễu 1)',
          'Phương án C (Nhiễu 2)',
          'Phương án D (Nhiễu 3)',
        ];
      } else if (opts.length > 4) {
        opts = opts.slice(0, 4);
      }

      const maxIdx = Math.max(0, opts.length - 1);
      const cIdx: number = Math.min(maxIdx, Math.max(0, Number(item?.correctIndex) || 0));
      const rawIndices: number[] = Array.isArray(item?.correctIndices)
        ? (item.correctIndices as unknown[])
            .map((n) => Number(n))
            .filter((n) => Number.isInteger(n) && n >= 0 && n <= maxIdx)
        : [cIdx];
      const cIndices: number[] =
        rawIndices.length > 0 ? Array.from(new Set<number>(rawIndices)) : [cIdx];
      const primaryIdx: number = cIndices[0] ?? 0;

      return {
        prompt: String(item?.prompt || '').trim() || `Câu hỏi về ${defaults.topic}`,
        questionType: qType,
        options: opts,
        correctIndex: primaryIdx,
        correctIndices: cIndices,
        correctAnswerText: String(item?.correctAnswerText || opts[primaryIdx] || '').trim(),
        matchingPairs: Array.isArray(item?.matchingPairs) ? item.matchingPairs : [],
        orderingItems: Array.isArray(item?.orderingItems) ? item.orderingItems : [],
        explanation:
          String(item?.explanation || '').trim() ||
          `Giải thích kiến thức chủ đề ${defaults.topic} (${defaults.subject}).`,
        educationLevel: defaults.educationLevel,
        gradeLevel: defaults.gradeLevel,
        subject: defaults.subject,
        topic: defaults.topic,
        lesson: defaults.lesson,
        cognitiveLevel: normalizeCognitive(item?.cognitiveLevel || defaults.cognitiveLevel),
        difficulty: normalizeDifficulty(item?.difficulty || defaults.difficulty),
        timeLimitSec: 20,
        points: 1000,
      };
    });
  }

  private buildPedagogicalFallbackQuestions(params: {
    subject: string;
    gradeLevel: string;
    educationLevel: string;
    topic: string;
    lesson: string;
    questionType: QuestionType;
    cognitiveLevel: CognitiveLevel;
    difficulty: DifficultyLevel;
    count: number;
    contextSnippet?: string;
  }): GeneratedDraftQuestion[] {
    const count = Math.min(15, Math.max(1, params.count));
    const list: GeneratedDraftQuestion[] = [];
    const stems = [
      `Khái niệm cốt lõi nào phản ánh đúng bản chất của "${params.topic}" trong môn ${params.subject} (${params.gradeLevel})?`,
      `Khi vận dụng kiến thức bài "${params.lesson || params.topic}", nhận định nào sau đây là CHÍNH XÁC nhất?`,
      `Đâu là đặc điểm phân biệt quan trọng nhất của "${params.topic}" so với các nội dung liên quan?`,
      `Trong tình huống thực tiễn liên quan đến "${params.topic}", phương án xử lý nào tuân thủ đúng nguyên tắc môn ${params.subject}?`,
      `Hệ quả hoặc kết luận nào sau đây được suy ra trực tiếp từ nội dung "${params.topic}"?`,
    ];

    for (let i = 0; i < count; i++) {
      const qType = params.questionType;
      const isTF = qType === 'TRUE_FALSE';
      const snippetNote = params.contextSnippet
        ? ` (Trích dẫn tư liệu: "${params.contextSnippet.slice(0, 90)}...")`
        : '';
      const prompt = `${stems[i % stems.length]}${snippetNote} [Câu ${i + 1}]`;
      const options = isTF
        ? ['Đúng', 'Sai']
        : [
            `Phản ánh chính xác quy luật và bản chất của ${params.topic} theo chương trình ${params.gradeLevel}`,
            `Chỉ đúng trong trường hợp ngoại lệ, không áp dụng cho ${params.topic}`,
            `Nhầm lẫn khái niệm của ${params.topic} với một chuyên đề khác`,
            `Thiếu điều kiện cần và đủ khi phân tích ${params.topic}`,
          ];
      list.push({
        prompt,
        questionType: qType,
        options,
        correctIndex: 0,
        correctIndices: qType === 'MULTIPLE_CHOICE' ? [0, 1] : [0],
        correctAnswerText: options[0],
        matchingPairs:
          qType === 'MATCHING'
            ? [
                { left: `Khái niệm ${params.topic} 1`, right: 'Định nghĩa chuẩn tương ứng 1' },
                { left: `Khái niệm ${params.topic} 2`, right: 'Định nghĩa chuẩn tương ứng 2' },
              ]
            : [],
        orderingItems:
          qType === 'ORDERING'
            ? ['Bước 1: Xác định dữ kiện', 'Bước 2: Phân tích quy luật', 'Bước 3: Kết luận']
            : [],
        explanation: `Câu hỏi kiểm tra mức độ ${params.cognitiveLevel} - Độ khó ${params.difficulty} thuộc chuyên đề ${params.topic} (${params.subject} - ${params.gradeLevel}). Giáo viên có thể tinh chỉnh số liệu cụ thể trước khi lưu.`,
        educationLevel: params.educationLevel,
        gradeLevel: params.gradeLevel,
        subject: params.subject,
        topic: params.topic,
        lesson: params.lesson,
        cognitiveLevel: params.cognitiveLevel,
        difficulty: params.difficulty,
        timeLimitSec: 20,
        points: 1000,
      });
    }
    return list;
  }

  public async generateFromPrompt(params: {
    subject: string;
    gradeLevel: string;
    educationLevel?: string;
    topic: string;
    lesson?: string;
    questionType?: QuestionType;
    cognitiveLevel?: CognitiveLevel;
    difficulty?: DifficultyLevel;
    count: number;
    additionalInstructions?: string;
  }): Promise<{ questions: GeneratedDraftQuestion[]; summary: string; usedFallback: boolean }> {
    const count = Math.min(15, Math.max(1, Number(params.count) || 5));
    const defaults = {
      subject: (params.subject || 'Tổng hợp').trim(),
      gradeLevel: (params.gradeLevel || 'Khối 12').trim(),
      educationLevel: (params.educationLevel || 'THPT').trim(),
      topic: (params.topic || 'Chuyên đề trọng tâm').trim(),
      lesson: (params.lesson || '').trim(),
      questionType: params.questionType || 'SINGLE_CHOICE',
      cognitiveLevel: params.cognitiveLevel || 'UNDERSTAND',
      difficulty: params.difficulty || 'MEDIUM',
    };

    if (!this.isApiKeyConfigured()) {
      return {
        questions: this.buildPedagogicalFallbackQuestions({ ...defaults, count }),
        summary: `Đã tạo ${count} câu hỏi khung sư phạm cho chủ đề "${defaults.topic}". Giáo viên có thể chỉnh sửa trực tiếp trước khi lưu vào ngân hàng.`,
        usedFallback: true,
      };
    }

    this.consumeQuotaOrThrow();
    try {
      const ai = this.createGenAiClient();
      const systemPrompt = `Bạn là chuyên gia biên soạn đề thi và kiểm tra đánh giá giáo dục Việt Nam.
Hãy biên soạn chính xác ${count} câu hỏi bằng tiếng Việt chuẩn mực, khoa học, không mơ hồ.
Thông số yêu cầu:
- Cấp học: ${defaults.educationLevel} | Khối lớp: ${defaults.gradeLevel}
- Môn học: ${defaults.subject}
- Chủ đề: ${defaults.topic} ${defaults.lesson ? `| Bài học: ${defaults.lesson}` : ''}
- Dạng câu hỏi ưu tiên: ${defaults.questionType}
- Mức độ nhận thức: ${defaults.cognitiveLevel} (REMEMBER=Nhận biết, UNDERSTAND=Thông hiểu, APPLY=Vận dụng, HIGH_APPLY=Vận dụng cao)
- Độ khó: ${defaults.difficulty} (EASY=Dễ, MEDIUM=Trung bình, HARD=Khó, VERY_HARD=Rất khó)
${params.additionalInstructions ? `- Yêu cầu bổ sung của giáo viên: ${params.additionalInstructions}` : ''}

Quy tắc bắt buộc:
1. Mỗi câu hỏi trắc nghiệm phải có 4 phương án rõ ràng, chỉ có 1 đáp án đúng cho SINGLE_CHOICE (hoặc 2-3 đáp án đúng cho MULTIPLE_CHOICE, hoặc 2 đáp án ['Đúng', 'Sai'] cho TRUE_FALSE).
2. Các phương án nhiễu phải hợp lý về mặt sư phạm, không vô nghĩa.
3. Kèm theo giải thích ngắn gọn, chính xác vì sao đáp án đó đúng.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: systemPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: this.getDraftQuestionsSchema(),
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const questions = this.sanitizeGeneratedList(parsed.questions, defaults);
      if (questions.length === 0) {
        throw new Error('Empty AI questions list');
      }
      return {
        questions,
        summary:
          parsed.summary ||
          `Trợ lý AI đã biên soạn ${questions.length} câu hỏi chủ đề "${defaults.topic}".`,
        usedFallback: false,
      };
    } catch {
      return {
        questions: this.buildPedagogicalFallbackQuestions({ ...defaults, count }),
        summary: `Đã tạo ${count} câu hỏi dự phòng theo cấu trúc sư phạm cho chủ đề "${defaults.topic}".`,
        usedFallback: true,
      };
    }
  }

  public async generateFromDocument(params: {
    fileName?: string;
    fileType?: 'DOCX' | 'TXT' | 'CSV' | 'RAW_TEXT';
    fileBase64?: string;
    rawText?: string;
    subject: string;
    gradeLevel: string;
    topic?: string;
    questionType?: QuestionType;
    cognitiveLevel?: CognitiveLevel;
    difficulty?: DifficultyLevel;
    count: number;
  }): Promise<{
    questions: GeneratedDraftQuestion[];
    extractedKeyPoints: string[];
    documentLength: number;
    usedFallback: boolean;
    warning?: string;
  }> {
    let documentText = (params.rawText || '').trim();

    if (params.fileBase64) {
      const cleanB64 = params.fileBase64.replace(/^data:[^;]+;base64,/, '');
      const buf = Buffer.from(cleanB64, 'base64');
      const fName = (params.fileName || '').toLowerCase();

      if (params.fileType === 'DOCX' || fName.endsWith('.docx')) {
        const extracted = await mammoth.extractRawText({ buffer: buf });
        documentText = (extracted.value || '').trim();
      } else if (params.fileType === 'CSV' || fName.endsWith('.csv') || fName.endsWith('.xlsx')) {
        const wb = XLSX.read(buf, { type: 'buffer' });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        documentText = XLSX.utils.sheet_to_txt(firstSheet).trim();
      } else {
        documentText = buf.toString('utf-8').trim();
      }
    }

    if (documentText.length < 40) {
      throw new ApiValidationError(
        'Nội dung tài liệu quá ngắn hoặc không đủ thông tin (tối thiểu 40 ký tự). Hệ thống từ chối tự suy diễn ngoài tài liệu — vui lòng cung cấp tài liệu đầy đủ hơn.',
        400
      );
    }

    const truncatedDoc = documentText.slice(0, 18000);
    const count = Math.min(15, Math.max(1, Number(params.count) || 5));
    const defaults = {
      subject: (params.subject || 'Tổng hợp').trim(),
      gradeLevel: (params.gradeLevel || 'Khối 12').trim(),
      educationLevel: 'THPT',
      topic: (params.topic || params.fileName || 'Tài liệu học tập').trim(),
      lesson: params.fileName || 'Tư liệu tải lên',
      questionType: params.questionType || 'SINGLE_CHOICE',
      cognitiveLevel: params.cognitiveLevel || 'UNDERSTAND',
      difficulty: params.difficulty || 'MEDIUM',
    };

    const sentences = truncatedDoc
      .split(/[.?!;\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 25);

    if (!this.isApiKeyConfigured()) {
      const keyPoints = sentences.slice(0, 5);
      return {
        questions: this.buildPedagogicalFallbackQuestions({
          ...defaults,
          count,
          contextSnippet: sentences[0] || truncatedDoc.slice(0, 120),
        }),
        extractedKeyPoints:
          keyPoints.length > 0 ? keyPoints : [truncatedDoc.slice(0, 150)],
        documentLength: documentText.length,
        usedFallback: true,
        warning:
          'Đã trích xuất nội dung văn bản từ tài liệu và khởi tạo câu hỏi bám sát đoạn trích.',
      };
    }

    this.consumeQuotaOrThrow();
    try {
      const ai = this.createGenAiClient();
      const prompt = `Bạn là trợ lý biên soạn câu hỏi kiểm tra dựa hoàn toàn trên tài liệu được cung cấp.
NGUYÊN TẮC BẮT BUỘC (SECTION IX):
- CHỈ tạo câu hỏi từ thông tin có thực trong TÀI LIỆU DƯỚI ĐÂY.
- TUYỆT ĐỐI KHÔNG tự suy diễn hoặc đưa kiến thức bên ngoài tài liệu vào câu hỏi.
- Hãy trích xuất các kiến thức trọng tâm vào trường "keyPoints" và biên soạn ${count} câu hỏi ở mức độ ${defaults.cognitiveLevel}, độ khó ${defaults.difficulty}, dạng ${defaults.questionType}.

=== NỘI DUNG TÀI LIỆU ===
${truncatedDoc}
=== KẾT THÚC TÀI LIỆU ===`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: this.getDraftQuestionsSchema(),
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const questions = this.sanitizeGeneratedList(parsed.questions, defaults);
      return {
        questions:
          questions.length > 0
            ? questions
            : this.buildPedagogicalFallbackQuestions({
                ...defaults,
                count,
                contextSnippet: sentences[0],
              }),
        extractedKeyPoints: Array.isArray(parsed.keyPoints)
          ? parsed.keyPoints.slice(0, 8)
          : sentences.slice(0, 5),
        documentLength: documentText.length,
        usedFallback: questions.length === 0,
      };
    } catch {
      return {
        questions: this.buildPedagogicalFallbackQuestions({
          ...defaults,
          count,
          contextSnippet: sentences[0] || truncatedDoc.slice(0, 120),
        }),
        extractedKeyPoints: sentences.slice(0, 5),
        documentLength: documentText.length,
        usedFallback: true,
      };
    }
  }

  public async generateFromImage(params: {
    mimeType: string;
    imageBase64: string;
    subject: string;
    gradeLevel: string;
    topic?: string;
    count: number;
    teacherPrompt?: string;
  }): Promise<{
    questions: GeneratedDraftQuestion[];
    imageAnalysisSummary: string;
    usedFallback: boolean;
  }> {
    const cleanB64 = (params.imageBase64 || '').replace(/^data:[^;]+;base64,/, '').trim();
    if (!cleanB64 || cleanB64.length < 30) {
      throw new ApiValidationError('Dữ liệu hình ảnh tải lên không hợp lệ.', 400);
    }

    const count = Math.min(10, Math.max(1, Number(params.count) || 3));
    const defaults = {
      subject: (params.subject || 'Khoa học').trim(),
      gradeLevel: (params.gradeLevel || 'Khối 12').trim(),
      educationLevel: 'THPT',
      topic: (params.topic || 'Phân tích hình ảnh / sơ đồ').trim(),
      lesson: 'Tư liệu trực quan',
      questionType: 'IMAGE_RECOGNITION' as QuestionType,
      cognitiveLevel: 'UNDERSTAND' as CognitiveLevel,
      difficulty: 'MEDIUM' as DifficultyLevel,
    };

    if (!this.isApiKeyConfigured()) {
      return {
        questions: this.buildPedagogicalFallbackQuestions({ ...defaults, count }),
        imageAnalysisSummary:
          'Đã nhận diện tệp hình ảnh tải lên và khởi tạo bộ câu hỏi nhận diện trực quan để giáo viên biên tập.',
        usedFallback: true,
      };
    }

    this.consumeQuotaOrThrow();
    try {
      const ai = this.createGenAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [
          {
            inlineData: {
              mimeType: params.mimeType || 'image/png',
              data: cleanB64,
            },
          },
          {
            text: `Hãy quan sát kỹ hình ảnh (trang sách, sơ đồ, bảng biểu hoặc hình minh họa học tập) và tạo ${count} câu hỏi trắc nghiệm bằng tiếng Việt cho môn ${defaults.subject} (${defaults.gradeLevel}).
${params.teacherPrompt ? `Hướng dẫn thêm từ giáo viên: ${params.teacherPrompt}` : ''}
Mỗi câu hỏi cần bám sát chi tiết hiển thị trên hình và có lời giải thích rõ ràng.`,
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: this.getDraftQuestionsSchema(),
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const questions = this.sanitizeGeneratedList(parsed.questions, defaults);
      return {
        questions:
          questions.length > 0
            ? questions
            : this.buildPedagogicalFallbackQuestions({ ...defaults, count }),
        imageAnalysisSummary:
          parsed.summary || 'Đã phân tích nội dung trực quan từ hình ảnh và đề xuất câu hỏi.',
        usedFallback: questions.length === 0,
      };
    } catch {
      return {
        questions: this.buildPedagogicalFallbackQuestions({ ...defaults, count }),
        imageAnalysisSummary:
          'Đã khởi tạo bộ câu hỏi nhận diện hình ảnh dự phòng để giáo viên rà soát và chỉnh sửa.',
        usedFallback: true,
      };
    }
  }
}

// ============================================================================
// 2. BULK IMPORT & EXPORT SERVICE (WORD .DOCX, EXCEL .XLSX/.XLS, CSV, JSON)
// ============================================================================
export class QuestionImportExportService {
  /**
   * Generates a standard Excel (.xlsx) or CSV template for teachers to download
   */
  public generateImportTemplate(format: 'XLSX' | 'CSV'): {
    fileName: string;
    mimeType: string;
    contentBase64: string;
  } {
    const sampleRows = [
      {
        'Nội dung câu hỏi': 'Định luật II Newton biểu diễn mối quan hệ giữa gia tốc, lực và đại lượng nào?',
        'Dạng câu hỏi': 'SINGLE_CHOICE',
        'Đáp án A': 'Khối lượng của vật (m)',
        'Đáp án B': 'Nhiệt độ tuyệt đối (T)',
        'Đáp án C': 'Điện tích nguyên tố (e)',
        'Đáp án D': 'Chu kỳ dao động (T)',
        'Đáp án đúng': 'A',
        'Giải thích': 'Theo công thức a = F/m, gia tốc tỉ lệ nghịch với khối lượng m của vật.',
        'Môn học': 'Vật lý',
        'Khối lớp': 'Khối 10',
        'Cấp học': 'THPT',
        'Chủ đề': 'Động lực học chất điểm',
        'Bài học': 'Ba định luật Newton',
        'Mức độ nhận thức': 'REMEMBER',
        'Độ khó': 'EASY',
        'Thời gian (giây)': 20,
        'Điểm số': 1000,
      },
      {
        'Nội dung câu hỏi': 'Những phát biểu nào sau đây đúng về nguyên phân ở tế bào nhân thực?',
        'Dạng câu hỏi': 'MULTIPLE_CHOICE',
        'Đáp án A': 'Tạo ra 2 tế bào con có bộ nhiễm sắc thể 2n giống hệt mẹ',
        'Đáp án B': 'Xảy ra ở tế bào sinh dưỡng và tế bào sinh dục sơ khai',
        'Đáp án C': 'Làm giảm một nửa số lượng nhiễm sắc thể',
        'Đáp án D': 'Chỉ xảy ra ở vi khuẩn nhân sơ',
        'Đáp án đúng': 'A, B',
        'Giải thích': 'Nguyên phân giữ nguyên bộ NST 2n và diễn ra ở tế bào sinh dưỡng.',
        'Môn học': 'Sinh học',
        'Khối lớp': 'Khối 10',
        'Cấp học': 'THPT',
        'Chủ đề': 'Chu kỳ tế bào',
        'Bài học': 'Nguyên phân',
        'Mức độ nhận thức': 'UNDERSTAND',
        'Độ khó': 'MEDIUM',
        'Thời gian (giây)': 25,
        'Điểm số': 1200,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Mau_Cau_Hoi');

    if (format === 'CSV') {
      const csvText = '\uFEFF' + XLSX.utils.sheet_to_csv(worksheet);
      return {
        fileName: 'Quizzi_Arena_Mau_Nhap_Cau_Hoi.csv',
        mimeType: 'text/csv;charset=utf-8',
        contentBase64: Buffer.from(csvText, 'utf-8').toString('base64'),
      };
    }

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return {
      fileName: 'Quizzi_Arena_Mau_Nhap_Cau_Hoi.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      contentBase64: Buffer.from(buffer).toString('base64'),
    };
  }

  /**
   * Parses Excel (.xlsx/.xls), CSV (.csv), or Word (.docx) base64 payload into validated ImportPreviewRow[]
   */
  public async parseImportFile(params: {
    fileName: string;
    fileBase64: string;
    existingPrompts: Set<string>;
    defaultSubject?: string;
    defaultGradeLevel?: string;
    columnMapping?: Record<string, string>;
  }): Promise<ImportPreviewResult> {
    const cleanB64 = (params.fileBase64 || '').replace(/^data:[^;]+;base64,/, '').trim();
    if (!cleanB64) {
      throw new ApiValidationError('Không tìm thấy dữ liệu tệp tải lên.', 400);
    }

    const buffer = Buffer.from(cleanB64, 'base64');
    const lowerName = (params.fileName || 'questions.xlsx').toLowerCase();

    if (lowerName.endsWith('.docx')) {
      return this.parseWordDocxBuffer(
        buffer,
        params.fileName,
        params.existingPrompts,
        params.defaultSubject || 'Tổng hợp',
        params.defaultGradeLevel || 'Khối 12'
      );
    }

    return this.parseExcelOrCsvBuffer(
      buffer,
      params.fileName,
      lowerName.endsWith('.csv') ? 'CSV' : 'XLSX',
      params.existingPrompts,
      params.defaultSubject || 'Tổng hợp',
      params.defaultGradeLevel || 'Khối 12',
      params.columnMapping
    );
  }

  private parseExcelOrCsvBuffer(
    buffer: Buffer,
    fileName: string,
    format: 'XLSX' | 'CSV',
    existingPrompts: Set<string>,
    defaultSubject: string,
    defaultGradeLevel: string,
    columnMapping?: Record<string, string>
  ): ImportPreviewResult {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer', codepage: 65001 });
    } catch {
      throw new ApiValidationError('Định dạng tệp bảng tính không hợp lệ hoặc bị hỏng.', 400);
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new ApiValidationError('Tệp bảng tính không có trang dữ liệu nào.', 400);
    }

    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[firstSheetName], {
      defval: '',
    });

    const detectedColumns = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
    const seenPromptsInFile = new Set<string>();
    const rows: ImportPreviewRow[] = [];

    const pickField = (row: Record<string, any>, logicalKey: string, aliases: string[]): any => {
      if (columnMapping && columnMapping[logicalKey] && row[columnMapping[logicalKey]] !== undefined) {
        return row[columnMapping[logicalKey]];
      }
      for (const key of Object.keys(row)) {
        const normKey = key.trim().toLowerCase();
        if (aliases.some((a) => normKey === a.toLowerCase() || normKey.includes(a.toLowerCase()))) {
          return row[key];
        }
      }
      return '';
    };

    rawRows.forEach((raw, idx) => {
      const prompt = String(
        pickField(raw, 'prompt', ['nội dung câu hỏi', 'câu hỏi', 'prompt', 'question', 'noidung'])
      ).trim();

      const qType = normalizeQuestionType(
        pickField(raw, 'questionType', ['dạng câu hỏi', 'loại câu hỏi', 'questiontype', 'type'])
      );

      const optA = String(pickField(raw, 'optionA', ['đáp án a', 'phương án a', 'option a', 'optiona', 'a'])).trim();
      const optB = String(pickField(raw, 'optionB', ['đáp án b', 'phương án b', 'option b', 'optionb', 'b'])).trim();
      const optC = String(pickField(raw, 'optionC', ['đáp án c', 'phương án c', 'option c', 'optionc', 'c'])).trim();
      const optD = String(pickField(raw, 'optionD', ['đáp án d', 'phương án d', 'option d', 'optiond', 'd'])).trim();

      let options = [optA, optB, optC, optD].filter(Boolean);
      if (qType === 'TRUE_FALSE') {
        options = ['Đúng', 'Sai'];
      }

      const rawCorrect = pickField(raw, 'correctAnswer', [
        'đáp án đúng',
        'đáp án',
        'correct',
        'answer',
        'dapan',
      ]);

      const explanation = String(
        pickField(raw, 'explanation', ['giải thích', 'hướng dẫn giải', 'explanation', 'giaithich'])
      ).trim();

      const subject =
        String(pickField(raw, 'subject', ['môn học', 'môn', 'subject'])).trim() || defaultSubject;
      const gradeLevel =
        String(pickField(raw, 'gradeLevel', ['khối lớp', 'khối', 'lớp', 'grade'])).trim() ||
        defaultGradeLevel;
      const educationLevel =
        String(pickField(raw, 'educationLevel', ['cấp học', 'cấp', 'educationlevel'])).trim() ||
        'THPT';
      const topic =
        String(pickField(raw, 'topic', ['chủ đề', 'chuyên đề', 'topic'])).trim() || 'Tổng hợp';
      const lesson = String(pickField(raw, 'lesson', ['bài học', 'bài', 'lesson'])).trim();
      const cognitiveLevel = normalizeCognitive(
        pickField(raw, 'cognitiveLevel', ['mức độ nhận thức', 'nhận thức', 'cognitive'])
      );
      const difficulty = normalizeDifficulty(
        pickField(raw, 'difficulty', ['độ khó', 'difficulty', 'dokho'])
      );
      const timeLimitSec = Math.min(
        180,
        Math.max(
          5,
          Number(pickField(raw, 'timeLimitSec', ['thời gian', 'time', 'giây'])) || 20
        )
      );
      const points = Math.min(
        10000,
        Math.max(100, Number(pickField(raw, 'points', ['điểm số', 'điểm', 'points'])) || 1000)
      );

      const errors: string[] = [];
      const warnings: string[] = [];

      if (!prompt || prompt.length < 5) {
        errors.push('Nội dung câu hỏi bị trống hoặc quá ngắn (< 5 ký tự).');
      }

      const isChoiceType =
        qType === 'SINGLE_CHOICE' ||
        qType === 'MULTIPLE_CHOICE' ||
        qType === 'IMAGE_CHOICE' ||
        qType === 'IMAGE_RECOGNITION' ||
        qType === 'AUDIO_QUESTION' ||
        qType === 'VIDEO_QUESTION';

      if (isChoiceType && options.length < 2) {
        errors.push('Câu hỏi trắc nghiệm phải có tối thiểu 2 phương án trả lời.');
      }

      if (!String(rawCorrect ?? '').trim()) {
        errors.push('Thiếu thông tin đáp án đúng.');
      }

      const parsedAns = parseAnswerIndices(rawCorrect, options, qType);
      const normPrompt = prompt.toLowerCase().replace(/\s+/g, ' ');
      const isDuplicate =
        Boolean(normPrompt) &&
        (existingPrompts.has(normPrompt) || seenPromptsInFile.has(normPrompt));

      if (normPrompt) {
        seenPromptsInFile.add(normPrompt);
      }

      if (isDuplicate) {
        warnings.push('Câu hỏi trùng lặp với ngân hàng hiện có hoặc trùng trong cùng tệp.');
      }
      if (!explanation) {
        warnings.push('Chưa có lời giải thích đáp án.');
      }

      rows.push({
        rowIndex: idx + 1,
        prompt,
        questionType: qType,
        options,
        correctIndex: parsedAns.correctIndex,
        correctIndices: parsedAns.correctIndices,
        correctAnswerText: parsedAns.correctAnswerText,
        matchingPairs: [],
        orderingItems: [],
        explanation,
        educationLevel,
        gradeLevel,
        subject,
        topic,
        lesson,
        cognitiveLevel,
        difficulty,
        timeLimitSec,
        points,
        isValid: errors.length === 0,
        isDuplicate,
        errors,
        warnings,
      });
    });

    return {
      fileName,
      format,
      totalRows: rows.length,
      validCount: rows.filter((r) => r.isValid).length,
      errorCount: rows.filter((r) => !r.isValid).length,
      duplicateCount: rows.filter((r) => r.isDuplicate).length,
      detectedColumns,
      rows,
    };
  }

  /**
   * Parses Word (.docx) files containing structured questions like:
   * Câu 1: Nội dung...
   * A. Đáp án 1
   * *B. Đáp án 2 (hoặc dòng "Đáp án: B")
   * C. Đáp án 3
   * D. Đáp án 4
   * Giải thích: ...
   */
  private async parseWordDocxBuffer(
    buffer: Buffer,
    fileName: string,
    existingPrompts: Set<string>,
    defaultSubject: string,
    defaultGradeLevel: string
  ): Promise<ImportPreviewResult> {
    let rawText = '';
    try {
      const extracted = await mammoth.extractRawText({ buffer });
      rawText = (extracted.value || '').trim();
    } catch {
      throw new ApiValidationError('Không thể đọc tệp Word (.docx). Vui lòng kiểm tra định dạng tệp.', 400);
    }

    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const blocks: Array<{
      promptLines: string[];
      options: string[];
      starredLetters: string[];
      explicitAnswerLine: string;
      explanationLine: string;
    }> = [];

    let currentBlock: {
      promptLines: string[];
      options: string[];
      starredLetters: string[];
      explicitAnswerLine: string;
      explanationLine: string;
    } | null = null;

    const questionHeaderRegex = /^(?:Câu\s*\d+|Question\s*\d+|\d+)[.:)\-]\s*(.+)$/i;
    const optionRegex = /^(\*?)([A-D])[.:)]\s*(.+)$/i;
    const answerLineRegex = /^(?:Đáp\s*án(?:\s*đúng)?|Answer)\s*[:\-]\s*(.+)$/i;
    const explanationRegex = /^(?:Giải\s*thích|Hướng\s*dẫn(?:\s*giải)?|Explanation)\s*[:\-]\s*(.+)$/i;

    for (const line of lines) {
      const qMatch = line.match(questionHeaderRegex);
      if (qMatch) {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = {
          promptLines: [qMatch[1].trim()],
          options: [],
          starredLetters: [],
          explicitAnswerLine: '',
          explanationLine: '',
        };
        continue;
      }

      if (!currentBlock) {
        currentBlock = {
          promptLines: [line],
          options: [],
          starredLetters: [],
          explicitAnswerLine: '',
          explanationLine: '',
        };
        continue;
      }

      const optMatch = line.match(optionRegex);
      if (optMatch) {
        const isStarred = optMatch[1] === '*';
        const letter = optMatch[2].toUpperCase();
        let optText = optMatch[3].trim();
        if (optText.includes('[Đúng]') || optText.includes('(Đúng)')) {
          currentBlock.starredLetters.push(letter);
          optText = optText.replace(/\[Đúng\]|\(Đúng\)/gi, '').trim();
        }
        if (isStarred) {
          currentBlock.starredLetters.push(letter);
        }
        currentBlock.options.push(optText);
        continue;
      }

      const ansMatch = line.match(answerLineRegex);
      if (ansMatch) {
        currentBlock.explicitAnswerLine = ansMatch[1].trim();
        continue;
      }

      const expMatch = line.match(explanationRegex);
      if (expMatch) {
        currentBlock.explanationLine = expMatch[1].trim();
        continue;
      }

      if (currentBlock.options.length === 0) {
        currentBlock.promptLines.push(line);
      }
    }

    if (currentBlock) {
      blocks.push(currentBlock);
    }

    const seenInFile = new Set<string>();
    const rows: ImportPreviewRow[] = blocks.map((b, idx) => {
      const prompt = b.promptLines.join(' ').trim();
      const options = b.options;
      const answerRaw =
        b.explicitAnswerLine ||
        (b.starredLetters.length > 0 ? b.starredLetters.join(', ') : '');
      const qType: QuestionType =
        b.starredLetters.length > 1 || answerRaw.includes(',')
          ? 'MULTIPLE_CHOICE'
          : options.length === 2 &&
              options[0].toLowerCase().includes('đúng') &&
              options[1].toLowerCase().includes('sai')
            ? 'TRUE_FALSE'
            : options.length === 0
              ? 'SHORT_ANSWER'
              : 'SINGLE_CHOICE';

      const parsedAns = parseAnswerIndices(answerRaw || 'A', options, qType);
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!prompt || prompt.length < 5) {
        errors.push('Nội dung câu hỏi trong file Word quá ngắn.');
      }
      if ((qType === 'SINGLE_CHOICE' || qType === 'MULTIPLE_CHOICE') && options.length < 2) {
        errors.push('Không nhận diện đủ tối thiểu 2 đáp án (A., B., C., D.).');
      }
      if (!answerRaw && (qType === 'SINGLE_CHOICE' || qType === 'MULTIPLE_CHOICE')) {
        warnings.push('Chưa đánh dấu đáp án đúng (mặc định chọn A — vui lòng kiểm tra lại).');
      }

      const normPrompt = prompt.toLowerCase().replace(/\s+/g, ' ');
      const isDuplicate =
        Boolean(normPrompt) && (existingPrompts.has(normPrompt) || seenInFile.has(normPrompt));
      if (normPrompt) seenInFile.add(normPrompt);
      if (isDuplicate) {
        warnings.push('Câu hỏi trùng với ngân hàng hiện có.');
      }

      return {
        rowIndex: idx + 1,
        prompt,
        questionType: qType,
        options,
        correctIndex: parsedAns.correctIndex,
        correctIndices: parsedAns.correctIndices,
        correctAnswerText: parsedAns.correctAnswerText,
        matchingPairs: [],
        orderingItems: [],
        explanation: b.explanationLine,
        educationLevel: 'THPT',
        gradeLevel: defaultGradeLevel,
        subject: defaultSubject,
        topic: 'Tài liệu Word',
        lesson: fileName,
        cognitiveLevel: 'UNDERSTAND',
        difficulty: 'MEDIUM',
        timeLimitSec: 20,
        points: 1000,
        isValid: errors.length === 0,
        isDuplicate,
        errors,
        warnings,
      };
    });

    return {
      fileName,
      format: 'DOCX',
      totalRows: rows.length,
      validCount: rows.filter((r) => r.isValid).length,
      errorCount: rows.filter((r) => !r.isValid).length,
      duplicateCount: rows.filter((r) => r.isDuplicate).length,
      detectedColumns: ['Câu hỏi', 'Đáp án A-D', 'Đáp án đúng', 'Giải thích'],
      rows,
    };
  }

  /**
   * Exports questions to XLSX, CSV, DOCX (Word-compatible HTML doc), or JSON
   * Supports both Full version (with answers + explanations) and Student Exam version (questions only)
   */
  public exportQuestions(params: {
    questions: FullQuestion[];
    format: 'XLSX' | 'CSV' | 'DOCX' | 'JSON';
    includeAnswers: boolean;
    title?: string;
  }): ExportResultPayload {
    const { questions, format, includeAnswers } = params;
    const baseTitle = (params.title || 'Ngan_Hang_Cau_Hoi_Quizzi').replace(/[^a-zA-Z0-9_-]/g, '_');
    const suffix = includeAnswers ? 'Day_Du_Dap_An' : 'De_Thi_Hoc_Sinh';

    if (format === 'JSON') {
      const sanitized = questions.map((q, idx) => {
        const base: Record<string, any> = {
          order: idx + 1,
          questionCode: q.questionCode,
          prompt: q.prompt,
          questionType: q.questionType,
          options: q.options,
          subject: q.subject,
          gradeLevel: q.gradeLevel,
          educationLevel: q.educationLevel,
          topic: q.topic,
          lesson: q.lesson,
          cognitiveLevel: q.cognitiveLevel,
          difficulty: q.difficulty,
          timeLimitSec: q.timeLimitSec,
          points: q.points,
        };
        if (includeAnswers) {
          base.correctIndex = q.correctIndex;
          base.correctIndices = q.correctIndices;
          base.correctAnswerText = q.correctAnswerText;
          base.matchingPairs = q.matchingPairs;
          base.orderingItems = q.orderingItems;
          base.explanation = q.explanation;
        }
        return base;
      });

      const jsonText = JSON.stringify(
        {
          title: params.title || 'Ngân hàng câu hỏi Quizzi Arena Pro',
          exportedAt: new Date().toISOString(),
          includeAnswers,
          totalQuestions: sanitized.length,
          questions: sanitized,
        },
        null,
        2
      );

      return {
        fileName: `${baseTitle}_${suffix}.json`,
        mimeType: 'application/json;charset=utf-8',
        format: 'JSON',
        includeAnswers,
        questionCount: questions.length,
        contentText: jsonText,
        contentBase64: Buffer.from(jsonText, 'utf-8').toString('base64'),
      };
    }

    if (format === 'DOCX') {
      const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
      const htmlItems = questions
        .map((q, idx) => {
          const optsHtml = (q.options || [])
            .map((opt, oIdx) => {
              const isCorrect =
                includeAnswers &&
                ((q.correctIndices && q.correctIndices.includes(oIdx)) || q.correctIndex === oIdx);
              return `<p style="margin:3px 0 3px 18px;${isCorrect ? 'font-weight:bold;color:#b45309;' : ''}">${letters[oIdx] || oIdx + 1}. ${opt} ${isCorrect ? '[ĐÁP ÁN ĐÚNG]' : ''}</p>`;
            })
            .join('');

          const answerFooter = includeAnswers
            ? `<p style="margin:6px 0 2px 0;color:#047857;font-size:11pt;"><strong>Đáp án đúng:</strong> ${
                q.options && q.options.length > 0
                  ? (q.correctIndices || [q.correctIndex])
                      .map((i) => letters[i] || i + 1)
                      .join(', ')
                  : q.correctAnswerText || 'Chấm tự luận'
              }</p>
               ${q.explanation ? `<p style="margin:2px 0 10px 0;color:#374151;font-size:10.5pt;"><em>Giải thích:</em> ${q.explanation}</p>` : ''}`
            : '<p style="margin:6px 0 12px 0;color:#6b7280;font-size:10pt;">Trả lời: ........................................................................</p>';

          return `<div style="margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid #e5e7eb;">
            <p style="margin:0 0 6px 0;font-size:12pt;"><strong>Câu ${idx + 1} (${q.questionCode || q.id} - ${q.points} điểm):</strong> ${q.prompt}</p>
            ${optsHtml}
            ${answerFooter}
          </div>`;
        })
        .join('\n');

      const docHtml = `\uFEFF<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${params.title || 'Đề thi Quizzi Arena Pro'}</title></head>
<body style="font-family:'Times New Roman',serif;font-size:12pt;line-height:1.45;">
  <h2 style="text-align:center;margin-bottom:4px;">${(params.title || 'BỘ CÂU HỎI KIỂM TRA QUIZZI ARENA PRO').toUpperCase()}</h2>
  <p style="text-align:center;margin-top:0;color:#4b5563;">Phiên bản: ${includeAnswers ? 'Đầy đủ đáp án và hướng dẫn giải (Dành cho Giáo viên)' : 'Đề bài luyện tập / kiểm tra (Dành cho Học sinh)'} — Tổng số: ${questions.length} câu</p>
  <hr/>
  ${htmlItems}
</body>
</html>`;

      return {
        fileName: `${baseTitle}_${suffix}.doc`,
        mimeType: 'application/msword;charset=utf-8',
        format: 'DOCX',
        includeAnswers,
        questionCount: questions.length,
        contentText: docHtml,
        contentBase64: Buffer.from(docHtml, 'utf-8').toString('base64'),
      };
    }

    // XLSX or CSV
    const letters = ['A', 'B', 'C', 'D'];
    const sheetRows = questions.map((q, idx) => {
      const row: Record<string, any> = {
        STT: idx + 1,
        'Mã câu hỏi': q.questionCode || q.id,
        'Nội dung câu hỏi': q.prompt,
        'Dạng câu hỏi': q.questionType,
        'Đáp án A': q.options?.[0] || '',
        'Đáp án B': q.options?.[1] || '',
        'Đáp án C': q.options?.[2] || '',
        'Đáp án D': q.options?.[3] || '',
      };

      if (includeAnswers) {
        row['Đáp án đúng'] =
          q.options && q.options.length > 0
            ? (q.correctIndices || [q.correctIndex]).map((i) => letters[i] || i + 1).join(', ')
            : q.correctAnswerText || '';
        row['Giải thích'] = q.explanation || '';
      }

      row['Môn học'] = q.subject || '';
      row['Khối lớp'] = q.gradeLevel || '';
      row['Cấp học'] = q.educationLevel || '';
      row['Chủ đề'] = q.topic || '';
      row['Bài học'] = q.lesson || '';
      row['Mức độ nhận thức'] = q.cognitiveLevel || 'REMEMBER';
      row['Độ khó'] = q.difficulty || 'MEDIUM';
      row['Thời gian (giây)'] = q.timeLimitSec || 20;
      row['Điểm số'] = q.points || 1000;
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(sheetRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cau_Hoi');

    if (format === 'CSV') {
      const csvText = '\uFEFF' + XLSX.utils.sheet_to_csv(worksheet);
      return {
        fileName: `${baseTitle}_${suffix}.csv`,
        mimeType: 'text/csv;charset=utf-8',
        format: 'CSV',
        includeAnswers,
        questionCount: questions.length,
        contentText: csvText,
        contentBase64: Buffer.from(csvText, 'utf-8').toString('base64'),
      };
    }

    const xlsxBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return {
      fileName: `${baseTitle}_${suffix}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      format: 'XLSX',
      includeAnswers,
      questionCount: questions.length,
      contentBase64: Buffer.from(xlsxBuffer).toString('base64'),
    };
  }
}
