import { trackAi } from './ai-audit.js';
import { Router, type RequestHandler } from 'express';
import { ContentStatus, ContentType, Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { ApiError, ok } from './http.js';
import { generate, privateBucket, question } from './learning-services.js';
import type { Config } from './config.js';

const id = z.string().min(1).max(128);
const skill = z.enum(ContentType);
const marks = z.enum(['HIGHLIGHT', 'NOTE', 'BOOKMARK']);
const passage = z.string().trim().min(1).max(10_000);
const lessonFields = z.object({
  courseId: id,
  contentType: skill,
  title: z.string().trim().min(2).max(120),
  body: passage,
  audioId: id.optional(),
  transcript: z.array(z.object({ second: z.number().finite().nonnegative(), text: z.string().trim().min(1).max(500) })).max(80).default([]),
  questions: z.array(question).max(20).default([]),
});
const practiceFields = lessonFields.pick({ body: true, audioId: true, transcript: true, questions: true });
const writeLesson = lessonFields.extend({ status: z.enum(ContentStatus).optional(), isPublic: z.boolean().optional() });
const objectiveInput = z.object({ answers: z.array(z.number().int().min(-1).max(4)).max(30) });
const productiveInput = z.object({
  attemptId: id.optional(),
  text: z.string().trim().max(15_000).default(''),
  audioId: id.optional(),
  submit: z.boolean(),
});
const audioMime = z.enum(['audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg']);
const audioBody = z.object({ mimeType: audioMime, data: z.base64().min(8).max(5_592_408) });
const maxAudioBytes = 4 * 1024 * 1024;
const lessonSelect = {
  id: true, courseId: true, title: true, contentType: true, status: true, ownerId: true, isPublic: true, preview: true,
} satisfies Prisma.ContentItemSelect;
type StudyDb = Prisma.TransactionClient;
type Practice = z.infer<typeof practiceFields>;
type Question = z.infer<typeof question>;

function readPractice(value: Prisma.JsonValue | null): Practice {
  const parsed = practiceFields.safeParse(value);
  if (!parsed.success) throw new ApiError(404, 'Bài này chưa có nội dung luyện tập.');
  return parsed.data;
}

function visible(userId: string): Prisma.ContentItemWhereInput {
  return {
    course: { language: 'en' },
    practice: { not: Prisma.DbNull },
    OR: [
      { ownerId: userId },
      { status: 'PUBLISHED', isPublic: true },
      { status: 'PUBLISHED', ownerId: null },
    ],
  };
}

function lessonKey(lessonId: string) {
  return /^\d{1,9}$/.test(lessonId) ? { publicId: Number(lessonId) } : { id: lessonId };
}

async function findLesson(db: StudyDb, lessonId: string, userId: string) {
  const lesson = await db.contentItem.findFirst({ where: { ...lessonKey(lessonId), ...visible(userId) } });
  if (!lesson) throw new ApiError(404, 'Không tìm thấy bài luyện tập.');
  return lesson;
}

async function findOwnedLesson(db: StudyDb, lessonId: string, userId: string) {
  const lesson = await db.contentItem.findFirst({ where: { ...lessonKey(lessonId), ownerId: userId } });
  if (!lesson) throw new ApiError(404, 'Không tìm thấy bài của bạn.');
  return lesson;
}

function publicQuestions(questions: Question[]) {
  return questions.map(({ prompt, options }) => ({ prompt, options }));
}

function grade(questions: Question[], answers: number[]) {
  if (answers.length !== questions.length || answers.some((answer, i) => answer >= questions[i].options.length)) {
    throw new ApiError(400, 'Danh sách lựa chọn không khớp với bài tập.');
  }
  const details = questions.map((question, i) => ({ ...question, selected: answers[i], correct: answers[i] === question.answer }));
  const correct = details.filter(item => item.correct).length;
  return { correct, total: details.length, score: Math.round(correct * 100 / details.length), details };
}

export function studyDate(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export async function recordStudy(db: StudyDb, userId: string) {
  const day = studyDate();
  await db.studyDay.createMany({ data: [{ userId, day }], skipDuplicates: true });
}

function metadata(media: { id: string; mimeType: string; objectKey: string | null }) {
  return { id: media.id, mimeType: media.mimeType, provider: media.objectKey ? 'supabase' : 'database' };
}

const mediaSelect = { id: true, mimeType: true, objectKey: true, ownerId: true } as const;

async function ownAudio(db: StudyDb, audioId: string, userId: string) {
  const item = await db.studyMedia.findFirst({ where: { id: audioId, ownerId: userId }, select: mediaSelect });
  if (!item) throw new ApiError(404, 'Không tìm thấy tệp âm thanh của bạn.');
  return item;
}

export async function readAudio(db: StudyDb, config: Config, audioId: string) {
  const item = await db.studyMedia.findUnique({ where: { id: audioId } });
  if (!item) throw new ApiError(404, 'Không tìm thấy tệp âm thanh.');
  if (!item.objectKey && item.bytes) return { mimeType: item.mimeType, data: Buffer.from(item.bytes).toString('base64') };
  const bucket = privateBucket(config);
  if (!bucket || !item.objectKey) throw new ApiError(503, 'Kho âm thanh chưa sẵn sàng.');
  const { data, error } = await bucket.download(item.objectKey);
  if (error || !data || data.size > maxAudioBytes) throw new ApiError(502, 'Không tải được tệp âm thanh.');
  return { mimeType: item.mimeType, data: Buffer.from(await data.arrayBuffer()).toString('base64') };
}

export function validAudio(bytes: Buffer, type: string) {
  if (bytes.length > maxAudioBytes || bytes.length < 12) return false;
  if (type.includes('m4a') || type === 'audio/mp4') return bytes.subarray(4, 8).toString('ascii') === 'ftyp';
  if (type === 'audio/wav') return bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WAVE';
  if (type === 'audio/ogg') return bytes.subarray(0, 4).toString('ascii') === 'OggS';
  if (type === 'audio/webm') return bytes.subarray(0, 4).toString('hex') === '1a45dfa3';
  return bytes.subarray(0, 3).toString('ascii') === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
}

export async function storeAudio(db:PrismaClient,config:Config,userId:string,mimeType:string,bytes:Buffer<ArrayBuffer>) {
  if (!audioMime.safeParse(mimeType).success || !validAudio(bytes,mimeType)) throw new ApiError(400,'Tệp âm thanh không hợp lệ hoặc lớn hơn 4 MB.');
    const bucket = privateBucket(config);
    const mediaId = crypto.randomUUID();
    const objectKey = bucket ? `${userId}/${mediaId}` : null;
    if (bucket && objectKey) {
      const { error } = await bucket.upload(objectKey, bytes, { contentType: mimeType, upsert: false });
      if (error) throw new ApiError(502, 'Không lưu được âm thanh lên Supabase Storage.');
    }
    try {
      const item = await db.studyMedia.create({ data: { id: mediaId, ownerId: userId, mimeType, objectKey, bytes: objectKey ? null : bytes },
        select: mediaSelect });
      return metadata(item);
    } catch (error) {
      if (bucket && objectKey) await bucket.remove([objectKey]).catch(() => undefined);
      throw error;
    }
}

export function studyRouter(db: PrismaClient, config: Config, auth: RequestHandler) {
  const router = Router();
  router.use(auth);

  router.get('/lessons', async (req, res) => {
    const input = z.object({
      view: z.enum(['explore', 'mine']).default('explore'),
      skill: skill.optional(),
      q: z.string().trim().max(100).optional(),
      courseId: id.optional(),
      page: z.coerce.number().int().min(1).max(1000).default(1),
    }).parse(req.query);
    const userId = res.locals.user.id as string;
    const scope = input.view === 'mine' ? { ownerId: userId } : {
      status: ContentStatus.PUBLISHED,
      OR: [{ ownerId: null }, { isPublic: true }, { ownerId: userId }],
      practice: { not: Prisma.DbNull },
    };
    const items = await db.contentItem.findMany({
      where: {
        ...scope, course: { language: 'en' },
        ...(input.skill ? { contentType: input.skill } : {}),
        ...(input.courseId ? { courseId: input.courseId } : {}),
        ...(input.q ? { title: { contains: input.q, mode: 'insensitive' } } : {}),
      },
      select: lessonSelect, orderBy: [{ order: 'asc' }, { id: 'asc' }], skip: (input.page - 1) * 24, take: 25,
    });
    ok(res, { items: items.slice(0, 24), hasMore: items.length > 24 });
  });

  router.get('/lessons/:id', async (req, res) => {
    const userId = res.locals.user.id as string;
    const lesson = await findLesson(db, id.parse(req.params.id), userId);
    const { body, questions, audioId, transcript } = readPractice(lesson.practice);
    const { practice: _practice, ...info } = lesson;
    const audioUrl = lesson.detail && typeof lesson.detail === 'object' && !Array.isArray(lesson.detail) ? lesson.detail.audioUrl : undefined;
    ok(res, { ...info, body, audioId, audioUrl, transcript, questions: publicQuestions(questions) });
  });

  router.get('/lessons/:id/edit', async (req, res) => {
    const lesson = await findOwnedLesson(db, id.parse(req.params.id), res.locals.user.id);
    ok(res, { courseId: lesson.courseId, title: lesson.title, contentType: lesson.contentType, status: lesson.status,
      isPublic: lesson.isPublic, ...readPractice(lesson.practice) });
  });

  function lessonData(input: z.infer<typeof lessonFields>) {
    const { courseId, contentType, title } = input;
    const practice = practiceFields.parse(input);
    return { courseId, contentType, title, practice, preview: practice.body.slice(0, 240) };
  }

  async function validateLesson(input: z.infer<typeof lessonFields>, userId: string) {
    const course = await db.course.findFirst({ where: { id: input.courseId, language: 'en' }, select: { id: true } });
    if (!course) throw new ApiError(404, 'Không tìm thấy khóa học.');
    if (input.audioId) {
      if (input.contentType !== 'LISTENING') throw new ApiError(400, 'Chỉ bài nghe cần tệp âm thanh.');
      await ownAudio(db, input.audioId, userId);
    }
    if (input.transcript.some((part, i) => i > 0 && part.second <= input.transcript[i - 1].second)) {
      throw new ApiError(400, 'Các mốc transcript phải tăng dần.');
    }
  }

  router.post('/lessons', async (req, res) => {
    const input = writeLesson.parse(req.body);
    const ownerId = res.locals.user.id as string;
    await validateLesson(input, ownerId);
    const data = lessonData(input);
    const lesson = await db.contentItem.create({
      data: { ...data, id: crypto.randomUUID(), ownerId, order: 100, minutes: 10,
        status: input.status ?? 'DRAFT', isPublic: input.status === 'PUBLISHED' && Boolean(input.isPublic) }, select: lessonSelect,
    });
    ok(res, lesson, 201);
  });

  router.put('/lessons/:id', async (req, res) => {
    const userId = res.locals.user.id as string;
    const lesson = await findOwnedLesson(db, id.parse(req.params.id), userId);
    const input = writeLesson.parse(req.body);
    await validateLesson(input, userId);
    const contentChanged = lesson.contentType !== input.contentType;
    if (contentChanged) throw new ApiError(400, 'Tạo bài mới để đổi kỹ năng và giữ lịch sử của bài hiện tại.');
    const status = input.status ?? lesson.status;
    const data = { ...lessonData(input), status, isPublic: status === 'PUBLISHED' && (input.isPublic ?? lesson.isPublic) };
    ok(res, await db.contentItem.update({ where: { id: lesson.id, ownerId: userId }, data, select: lessonSelect }));
  });

  router.patch('/lessons/:id/status', async (req, res) => {
    const userId = res.locals.user.id as string;
    const lesson = await findOwnedLesson(db, id.parse(req.params.id), userId);
    const input = z.object({ status: z.enum(ContentStatus), isPublic: z.boolean().default(false) }).parse(req.body);
    const data = { status: input.status, isPublic: input.status === 'PUBLISHED' && input.isPublic };
    ok(res, await db.contentItem.update({ where: { id: lesson.id, ownerId: userId }, data, select: lessonSelect }));
  });

  router.post('/lessons/:id/clone', async (req, res) => {
    const ownerId = res.locals.user.id as string;
    const source = await findLesson(db, id.parse(req.params.id), ownerId);
    const { audioId, ...practice } = readPractice(source.practice);
    const audio = audioId && source.ownerId === ownerId ? { audioId } : {};
    const { courseId, title, preview, minutes, contentType } = source;
    ok(res, await db.contentItem.create({
      data: { id: crypto.randomUUID(), ownerId, courseId, title: `Bản sao · ${title}`.slice(0, 120), preview,
        minutes, contentType, practice: { ...practice, ...audio }, order: 100, status: 'DRAFT' },
      select: lessonSelect,
    }), 201);
  });

  router.post('/lessons/:id/report', async (req, res) => {
    const userId = res.locals.user.id as string;
    const lesson = await findLesson(db, id.parse(req.params.id), userId);
    if (!lesson.isPublic || !lesson.ownerId || lesson.ownerId === userId) throw new ApiError(400, 'Chỉ báo cáo bài công khai của người khác.');
    const { reason } = z.object({ reason: z.string().trim().min(5).max(500) }).parse(req.body);
    await db.contentReport.upsert({ where: { userId_lessonId: { userId, lessonId: lesson.id } },
      create: { userId, lessonId: lesson.id, reason }, update: { reason } });
    ok(res, { reported: true });
  });

  router.get('/lessons/:id/annotations', async (req, res) => {
    const userId = res.locals.user.id as string;
    const lesson = await findLesson(db, id.parse(req.params.id), userId);
    ok(res, await db.annotation.findMany({ where: { userId, lessonId: lesson.id, archived:false }, orderBy: [{pinned:'desc'},{createdAt:'desc'}], take: 100 }));
  });

  router.post('/lessons/:id/annotations', async (req, res) => {
    const userId = res.locals.user.id as string;
    const lesson = await findLesson(db, id.parse(req.params.id), userId);
    if (!['READING', 'LISTENING'].includes(lesson.contentType)) throw new ApiError(400, 'Ghi chú có trong bài đọc và bài nghe.');
    const data = z.object({ kind: marks, quote: z.string().trim().max(500).default(''), note: z.string().trim().max(1000).default('') }).parse(req.body);
    const practice = readPractice(lesson.practice);
    if (data.kind === 'HIGHLIGHT' && !data.quote || data.kind === 'NOTE' && !data.note) throw new ApiError(400, 'Hãy nhập nội dung cần lưu.');
    if (data.quote && ![practice.body, ...practice.transcript.map(part => part.text)].some(text => text.includes(data.quote))) {
      throw new ApiError(400, 'Đoạn trích phải nằm trong bài.');
    }
    ok(res, await db.annotation.create({ data: { userId, lessonId: lesson.id, ...data } }), 201);
  });

  router.delete('/annotations/:id', async (req, res) => {
    const result = await db.annotation.deleteMany({ where: { id: id.parse(req.params.id), userId: res.locals.user.id } });
    if (!result.count) throw new ApiError(404, 'Không tìm thấy ghi chú.');
    ok(res, { deleted: true });
  });

  router.get('/words', async (_req, res) => {
    ok(res, await db.savedWord.findMany({ where: { userId: res.locals.user.id }, orderBy: { createdAt: 'desc' }, take: 200 }));
  });

  router.put('/words', async (req, res) => {
    const userId = res.locals.user.id as string;
    const { word, meaning } = z.object({
      word: z.string().trim().min(1).max(120).toLowerCase(), meaning: z.string().trim().max(500).default(''),
    }).parse(req.body);
    ok(res, await db.savedWord.upsert({ where: { userId_word: { userId, word } }, create: { userId, word, meaning }, update: { meaning } }));
  });

  router.delete('/words', async (req, res) => {
    const { word } = z.object({ word: z.string().trim().min(1).max(120).toLowerCase() }).parse(req.query);
    await db.savedWord.deleteMany({ where: { userId: res.locals.user.id, word } });
    ok(res, { deleted: true });
  });

  router.get('/lessons/:id/attempts', async (req, res) => {
    const userId = res.locals.user.id as string;
    const lesson = await findLesson(db, id.parse(req.params.id), userId);
    ok(res, await db.studyAttempt.findMany({ where: { userId, lessonId: lesson.id }, orderBy: { updatedAt: 'desc' }, take: 30 }));
  });

  router.post('/lessons/:id/assessment', async (req, res) => {
    const userId = res.locals.user.id as string;
    const lesson = await findLesson(db, id.parse(req.params.id), userId);
    const { questions } = readPractice(lesson.practice);
    if (lesson.status !== 'PUBLISHED' || !questions.length) throw new ApiError(400, 'Bài chưa xuất bản hoặc chưa có câu hỏi.');
    const { answers } = objectiveInput.parse(req.body);
    const result = grade(questions, answers);
    const attempt = await db.$transaction(async (tx) => {
      const item = await tx.studyAttempt.create({ data: { userId, lessonId: lesson.id, mode: 'ASSESSMENT', state: 'COMPLETED',
        response: { answers }, feedback: result, score: result.score } });
      await recordStudy(tx, userId);
      return item;
    });
    ok(res, attempt, 201);
  });

  router.post('/lessons/:id/submission', async (req, res) => {
    const userId = res.locals.user.id as string;
    const lesson = await findLesson(db, id.parse(req.params.id), userId);
    if (lesson.status !== 'PUBLISHED' || !['SPEAKING', 'WRITING'].includes(lesson.contentType)) {
      throw new ApiError(400, 'Bài này không nhận bài nộp.');
    }
    const input = productiveInput.parse(req.body);
    const speaking = lesson.contentType === 'SPEAKING';
    if (input.audioId) {
      if (!speaking) throw new ApiError(400, 'Bài viết không nhận bản ghi âm.');
      await ownAudio(db, input.audioId, userId);
    }
    if (input.submit && (speaking ? !input.audioId : !input.text)) throw new ApiError(400, 'Cần có nội dung trước khi nộp bài.');
    const scope = { userId, lessonId: lesson.id, mode: lesson.contentType, state: 'DRAFT' };
    const response = { text: input.text, ...(input.audioId ? { audioId: input.audioId } : {}),
      ...(input.submit ? { assignment: `${lesson.title}\n${readPractice(lesson.practice).body}` } : {}),
    };
    const attempt = await db.$transaction(async tx => {
      const data = { response, state: input.submit ? 'SUBMITTED' : 'DRAFT', submittedAt: input.submit ? new Date() : undefined };
      const item = input.attemptId
        ? await (async () => {
          const changed = await tx.studyAttempt.updateMany({ where: { id: input.attemptId, ...scope }, data });
          if (!changed.count) throw new ApiError(409, 'Bản nháp đã được nộp hoặc không còn tồn tại.');
          return tx.studyAttempt.findUniqueOrThrow({ where: { id: input.attemptId } });
        })()
        : await tx.studyAttempt.create({ data: { ...scope, ...data } });
      if (input.submit) await recordStudy(tx, userId);
      return item;
    });
    ok(res, attempt, input.attemptId ? 200 : 201);
  });

  router.post('/attempts/:id/feedback', async (req, res) => {
    const userId = res.locals.user.id as string;
    const attemptId = id.parse(req.params.id);
    const attempt = await db.studyAttempt.findFirst({ where: { id: attemptId, userId, state: 'SUBMITTED', mode: { in: ['WRITING', 'SPEAKING'] } },
      include: { lesson: { select: { title: true, practice: true } } } });
    if (!attempt) throw new ApiError(409, 'Bài nộp chưa sẵn sàng để chấm.');
    const response = productiveInput.pick({ text: true, audioId: true }).extend({ assignment: z.string().optional() }).parse(attempt.response);
    const assignment = response.assignment ?? `${attempt.lesson.title}\n${readPractice(attempt.lesson.practice).body}`;
    const prompt = `Assignment: ${assignment}\nStudent response: ${response.text}`;
    const media = response.audioId ? await readAudio(db, config, response.audioId) : undefined;
    const result = await generate(trackAi(config, db, userId, attempt.mode.toLowerCase() + '.feedback'), attempt.mode === 'SPEAKING' ? 'speaking-feedback' : 'writing-feedback', prompt, media);
    const changed = await db.studyAttempt.updateMany({ where: { id: attemptId, userId, state: 'SUBMITTED' },
      data: { feedback: result, score: result.score, state: 'COMPLETED', completedAt: new Date() } });
    if (!changed.count) throw new ApiError(409, 'Bài đã được chấm. Tải lại lịch sử để xem kết quả.');
    ok(res, await db.studyAttempt.findUniqueOrThrow({ where: { id: attemptId } }));
  });

  router.post('/quizzes', async (req, res) => {
    const userId = res.locals.user.id as string;
    const { mode } = z.object({ mode: z.enum(['QUIZ', 'EXAM']) }).parse(req.body);
    const sources = await db.contentItem.findMany({ where: { ownerId: null, status: 'PUBLISHED', practice: { not: Prisma.DbNull }, course: { language: 'en' } },
      select: { practice: true }, orderBy: { id: 'asc' }, take: 100 });
    const bank = sources.flatMap(source => readPractice(source.practice).questions);
    for (let i = bank.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bank[i], bank[j]] = [bank[j], bank[i]];
    }
    const questions = bank.slice(0, mode === 'EXAM' ? 20 : 5);
    if (!questions.length) throw new ApiError(409, 'Ngân hàng câu hỏi chưa có dữ liệu.');
    const quiz = await db.quizAttempt.create({ data: { userId, mode, questions, expiresAt: mode === 'EXAM' ? new Date(Date.now() + 10 * 60_000) : null } });
    ok(res, { id: quiz.id, mode, expiresAt: quiz.expiresAt, questions: publicQuestions(questions) }, 201);
  });

  router.get('/quizzes', async (_req, res) => {
    ok(res, await db.quizAttempt.findMany({ where: { userId: res.locals.user.id },
      select: { id: true, mode: true, result: true, expiresAt: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 30 }));
  });

  router.get('/quizzes/:id', async (req, res) => {
    const quiz = await db.quizAttempt.findFirst({ where: { id: id.parse(req.params.id), userId: res.locals.user.id } });
    if (!quiz) throw new ApiError(404, 'Không tìm thấy lượt làm bài.');
    ok(res, { id: quiz.id, mode: quiz.mode, expiresAt: quiz.expiresAt, questions: publicQuestions(z.array(question).parse(quiz.questions)), result: quiz.result });
  });

  router.post('/quizzes/:id/submit', async (req, res) => {
    const userId = res.locals.user.id as string;
    const quiz = await db.quizAttempt.findFirst({ where: { id: id.parse(req.params.id), userId } });
    if (!quiz) throw new ApiError(404, 'Không tìm thấy lượt làm bài.');
    if (quiz.result) return ok(res, quiz.result);
    const { answers } = objectiveInput.parse(req.body);
    const now = new Date();
    if (quiz.expiresAt && quiz.expiresAt <= now) throw new ApiError(409, 'Bài thi đã hết giờ.');
    const result = grade(z.array(question).parse(quiz.questions), answers);
    await db.$transaction(async tx => {
      const changed = await tx.quizAttempt.updateMany({ where: { id: quiz.id, userId, result: { equals: Prisma.DbNull },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, data: { result } });
      if (!changed.count) throw new ApiError(409, 'Lượt làm bài đã thay đổi. Mở lại bài để xem kết quả.');
      await recordStudy(tx, userId);
    });
    ok(res, result);
  });

  router.post('/audio', async (req, res) => {
    const userId = res.locals.user.id as string;
    const { data, mimeType } = audioBody.parse(req.body);
    const bytes = Buffer.from(data, 'base64');
    if (!validAudio(bytes, mimeType)) throw new ApiError(400, 'Tệp âm thanh không hợp lệ hoặc lớn hơn 4 MB.');
    ok(res, await storeAudio(db,config,userId,mimeType,bytes),201);
  });

  router.get('/audio/:id', async (req, res) => {
    const userId = res.locals.user.id as string;
    const audioId = id.parse(req.params.id);
    const item = await db.studyMedia.findUnique({ where: { id: audioId }, select: mediaSelect });
    if (!item) throw new ApiError(404, 'Không tìm thấy tệp âm thanh.');
    if (item.ownerId !== userId) {
      const lesson = await db.contentItem.findFirst({ where: { ...visible(userId), practice: { path: ['audioId'], equals: audioId } }, select: { id: true } });
      if (!lesson) throw new ApiError(404, 'Không tìm thấy tệp âm thanh.');
    }
    const bucket = privateBucket(config);
    if (item.objectKey && bucket) {
      const { data, error } = await bucket.createSignedUrl(item.objectKey, 300);
      if (error || !data) throw new ApiError(502, 'Không mở được âm thanh.');
      return ok(res, { url: data.signedUrl, mimeType: item.mimeType });
    }
    ok(res, await readAudio(db, config, audioId));
  });

  return router;
}
