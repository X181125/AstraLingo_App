import { Router, type RequestHandler } from 'express';
import { Prisma, type ContentItem, type LessonAssessment, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { ApiError, ok } from './http.js';
import { generate, question } from './learning-services.js';
import { recordStudy } from './study.js';
import type { Config } from './config.js';

const identifier = z.coerce.number().int().positive().max(2147483647);
const title = z.string().trim().min(1).max(120);
const options = z
  .array(z.object({ optionText: z.string().trim().min(1).max(500), isCorrect: z.boolean() }))
  .min(2)
  .max(8);
const authored = z
  .object({
    questionText: z.string().trim().min(1).max(1000),
    questionType: z.enum(['MCQ', 'TF', 'FILL', 'SHORT', 'ORDERING']),
    explanation: z.string().max(1000).nullish(),
    options: options.optional(),
    answerText: z.string().trim().max(500).optional(),
  })
  .refine(
    (q) =>
      q.questionType === 'MCQ' || q.questionType === 'TF'
        ? q.options?.filter((o) => o.isCorrect).length === 1
        : !!q.answerText || q.options?.some((o) => o.isCorrect),
    'Mỗi câu cần có đáp án để chấm.',
  );
const setFields = z.object({ title: title.optional(), questions: z.array(authored).min(1).max(40) });
type Q = z.infer<typeof authored>;
const object = (v: Prisma.JsonValue | null): Prisma.JsonObject =>
  v && typeof v === 'object' && !Array.isArray(v) ? v : {};
function convert(q: z.infer<typeof question>): Q {
  return {
    questionText: q.prompt,
    questionType: 'MCQ',
    explanation: q.explanation,
    options: q.options.map((optionText, i) => ({ optionText, isCorrect: i === q.answer })),
  };
}
function questionsView(questions: Q[], key: boolean) {
  return questions.map((q, i) => ({
    id: i + 1,
    questionText: q.questionText,
    questionType: q.questionType,
    ...(key && { explanation: q.explanation, answerText: q.answerText }),
    options: (q.options ?? []).map((o, j) => ({
      id: j + 1,
      optionText: o.optionText,
      ...(key && { isCorrect: o.isCorrect }),
    })),
  }));
}
function summary(item: LessonAssessment, lesson: ContentItem) {
  return {
    id: item.id,
    passageId: lesson.publicId,
    audioId: lesson.publicId,
    title: item.title,
    isActive: item.isActive,
    createdAt: item.createdAt,
    questionCount: Array.isArray(item.questions) ? item.questions.length : 0,
  };
}

export function assessmentRoutes(db: PrismaClient, config: Config, auth: RequestHandler, aiLimit: RequestHandler) {
  const router = Router();
  for (const kind of ['reading', 'listening'] as const) {
    const prefix = '/' + (kind === 'reading' ? 'reading-passages' : 'listening-audios') + '/:id';
    const collection = prefix + '/assessments',
      entity = '/' + kind + '-assessments/:id',
      attempts = '/' + kind + '-attempts/:id';
    const skill = kind === 'reading' ? 'READING' : 'LISTENING';
    async function lesson(raw: unknown, userId: string, own = false) {
      const row = await db.contentItem.findFirst({
        where: {
          publicId: identifier.parse(raw),
          contentType: skill,
          course: { language: 'en' },
          ...(own
            ? { ownerId: userId }
            : { OR: [{ ownerId: userId }, { status: 'PUBLISHED', OR: [{ isPublic: true }, { ownerId: null }] }] }),
        },
      });
      if (!row) throw new ApiError(404, 'Không tìm thấy bài luyện.');
      return row;
    }
    async function findSet(raw: unknown, userId: string, own = false) {
      const item = await db.lessonAssessment.findUnique({
        where: { id: identifier.parse(raw) },
        include: { lesson: true },
      });
      if (!item) throw new ApiError(404, 'Không tìm thấy bộ câu hỏi.');
      await lesson(item.lesson.publicId, userId, own);
      return item;
    }
    async function initialize(item: ContentItem) {
      const base = z.array(question).min(1).safeParse(object(item.practice).questions);
      if (!base.success || (await db.lessonAssessment.count({ where: { lessonId: item.id } }))) return;
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "ContentItem" WHERE id=${item.id} FOR UPDATE`;
        if (!(await tx.lessonAssessment.count({ where: { lessonId: item.id } })))
          await tx.lessonAssessment.create({
            data: { lessonId: item.id, title: item.title, questions: base.data.map(convert), isActive: true },
          });
      });
    }
    router.get([collection, collection + '/active', collection + '/latest'], auth, async (req, res) => {
      const item = await lesson(req.params.id, res.locals.user.id);
      await initialize(item);
      const rows = await db.lessonAssessment.findMany({ where: { lessonId: item.id }, orderBy: { id: 'desc' } });
      if (req.path.endsWith('/assessments'))
        return ok(
          res,
          rows.map((row) => summary(row, item)),
        );
      const row = req.path.endsWith('/active') ? rows.find((x) => x.isActive) : rows[0];
      ok(
        res,
        row
          ? { ...summary(row, item), questions: questionsView(z.array(authored).parse(row.questions), false) }
          : null,
      );
    });
    const add: RequestHandler = async (req, res) => {
      const item = await lesson(req.params.id, res.locals.user.id, true);
      const input = req.path.endsWith('/generate')
        ? {
            title: item.title,
            questions: (
              await generate(config, 'questions', String(object(item.practice).body ?? item.preview))
            ).questions.map(convert),
          }
        : setFields.parse(req.body);
      const row = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "ContentItem" WHERE id=${item.id} FOR UPDATE`;
        const first = !(await tx.lessonAssessment.count({ where: { lessonId: item.id } }));
        return tx.lessonAssessment.create({
          data: {
            lessonId: item.id,
            title: input.title ?? item.title,
            questions: input.questions,
            isActive: first,
          },
        });
      });
      ok(res, { ...summary(row, item), questions: questionsView(input.questions, true) }, 201);
    };
    router.post(collection, auth, add);
    router.post(collection + '/generate', auth, aiLimit, add);
    router.get(entity, auth, async (req, res) => {
      const row = await findSet(req.params.id, res.locals.user.id);
      ok(res, {
        ...summary(row, row.lesson),
        questions: questionsView(
          z.array(authored).parse(row.questions),
          row.lesson.ownerId === res.locals.user.id,
        ),
      });
    });
    router.patch(entity, auth, async (req, res) => {
      const row = await findSet(req.params.id, res.locals.user.id, true);
      const data = setFields.partial().parse(req.body);
      const updated = await db.lessonAssessment.update({ where: { id: row.id }, data });
      ok(res, {
        ...summary(updated, row.lesson),
        questions: questionsView(z.array(authored).parse(updated.questions), true),
      });
    });
    router.patch([entity + '/active', entity + '/activate', entity + '/deactivate'], auth, async (req, res) => {
      const row = await findSet(req.params.id, res.locals.user.id, true);
      const active = !req.path.endsWith('/deactivate');
      const updated = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "ContentItem" WHERE id=${row.lessonId} FOR UPDATE`;
        if (active)
          await tx.lessonAssessment.updateMany({
            where: { lessonId: row.lessonId, isActive: true },
            data: { isActive: false },
          });
        return tx.lessonAssessment.update({ where: { id: row.id }, data: { isActive: active } });
      });
      ok(res, summary(updated, row.lesson));
    });
    router.delete(entity, auth, async (req, res) => {
      const row = await findSet(req.params.id, res.locals.user.id, true);
      const removed = await db.lessonAssessment.deleteMany({ where: { id: row.id, runs: { none: {} } } });
      if (!removed.count) throw new ApiError(409, 'Bộ câu hỏi có lịch sử làm bài.');
      ok(res, { deleted: true, assessmentId: row.id });
    });
    const include = { assessment: { include: { lesson: true } } } as const;
    type Run = Prisma.AssessmentRunGetPayload<{ include: typeof include }>;
    function attemptView(run: Run) {
      return {
        id: run.id,
        userId: run.userId,
        passageId: run.assessment.lesson.publicId,
        audioId: run.assessment.lesson.publicId,
        assessmentId: run.assessmentId,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        score: object(run.result).score ?? null,
        timeSpentSec: run.finishedAt
          ? Math.round((run.finishedAt.getTime() - run.startedAt.getTime()) / 1000)
          : null,
        answersJson: run.answers ?? [],
        questions: questionsView(z.array(authored).parse(run.snapshot), false),
      };
    }
    async function ownRun(raw: unknown, userId: string) {
      const run = await db.assessmentRun.findFirst({
        where: { id: identifier.parse(raw), userId, assessment: { lesson: { contentType: skill } } },
        include,
      });
      if (!run) throw new ApiError(404, 'Không tìm thấy lượt làm bài.');
      return run;
    }
    router.post(prefix + '/attempts', auth, async (req, res) => {
      const userId = res.locals.user.id,
        item = await lesson(req.params.id, userId);
      if (item.status !== 'PUBLISHED') throw new ApiError(409, 'Bài luyện chưa xuất bản.');
      await initialize(item);
      const { assessmentId } = z.object({ assessmentId: identifier.optional() }).parse(req.body ?? {});
      const set = await db.lessonAssessment.findFirst({
        where: { lessonId: item.id, ...(assessmentId ? { id: assessmentId } : { isActive: true }) },
      });
      if (!set) throw new ApiError(404, 'Chưa có bộ câu hỏi đang hoạt động.');
      const run = await db.assessmentRun.create({
        data: { userId, assessmentId: set.id, snapshot: set.questions as Prisma.InputJsonValue },
        include,
      });
      ok(res, attemptView(run), 201);
    });
    router.get(prefix + '/attempts/mine', auth, async (req, res) => {
      const item = await lesson(req.params.id, res.locals.user.id);
      const rows = await db.assessmentRun.findMany({
        where: { userId: res.locals.user.id, assessment: { lessonId: item.id } },
        orderBy: { id: 'desc' },
        take: identifier.max(100).default(30).parse(req.query.limit),
        include,
      });
      ok(res, rows.map(attemptView));
    });
    router.get(
      [attempts, attempts + '/result', attempts + '/review', attempts + '/resume'],
      auth,
      async (req, res) => {
        const row = await ownRun(req.params.id, res.locals.user.id);
        ok(res, { attempt: attemptView(row), result: row.result });
      },
    );
    const answers = z
      .array(
        z.object({
          questionId: identifier,
          selectedOptionId: identifier.optional(),
          answerText: z.string().max(500).optional(),
        }),
      )
      .max(40);
    const respond: RequestHandler = async (req, res) => {
      const row = await ownRun(req.params.id, res.locals.user.id);
      if (row.finishedAt) return ok(res, { attempt: attemptView(row), result: row.result });
      const questions = z.array(authored).parse(row.snapshot),
        choices = answers.parse(req.body?.answers ?? row.answers ?? []);
      const ids = new Set(choices.map((a) => a.questionId));
      if (
        ids.size !== choices.length ||
        choices.some(
          (a) =>
            a.questionId > questions.length ||
            (a.selectedOptionId && a.selectedOptionId > (questions[a.questionId - 1].options?.length ?? 0)),
        )
      )
        throw new ApiError(400, 'Đáp án không khớp bộ câu hỏi.');
      if (req.path.endsWith('/answers') || req.path.endsWith('/progress')) {
        const change = await db.assessmentRun.updateMany({
          where: { id: row.id, finishedAt: null },
          data: { answers: choices },
        });
        if (!change.count) throw new ApiError(409, 'Bài đã nộp.');
        return ok(res, attemptView(await ownRun(row.id, row.userId)));
      }
      const normalize = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');
      const graded = questions.map((q, i) => {
        const choice = choices.find((a) => a.questionId === i + 1),
          correctOptionIds = (q.options ?? []).flatMap((o, j) => (o.isCorrect ? [j + 1] : []));
        const expected = q.answerText ?? q.options?.find((o) => o.isCorrect)?.optionText ?? '';
        return {
          questionId: i + 1,
          questionType: q.questionType,
          selectedOptionId: choice?.selectedOptionId ?? null,
          correctOptionIds,
          isCorrect:
            !!choice &&
            (choice.selectedOptionId !== undefined
              ? correctOptionIds.includes(choice.selectedOptionId)
              : !!choice.answerText && normalize(choice.answerText) === normalize(expected)),
          explanation: q.explanation ?? null,
        };
      });
      const correctCount = graded.filter((q) => q.isCorrect).length,
        score = Math.round((100 * correctCount) / questions.length);
      const result = {
        assessmentId: row.assessmentId,
        totalGradable: questions.length,
        correctCount,
        score,
        questions: graded,
      };
      await db.$transaction(async (tx) => {
        const finishedAt = new Date();
        const change = await tx.assessmentRun.updateMany({
          where: { id: row.id, finishedAt: null },
          data: { finishedAt, answers: choices, result },
        });
        if (!change.count) return;
        const details = questions.map((q, i) => ({
          prompt: q.questionText,
          options: q.options?.map((o) => o.optionText) ?? [q.answerText ?? ''],
          answer: q.options?.findIndex((o) => o.isCorrect) ?? 0,
          explanation: q.explanation ?? '',
          selected: (graded[i].selectedOptionId ?? 0) - 1,
          correct: graded[i].isCorrect,
        }));
        await tx.studyAttempt.create({
          data: {
            userId: row.userId,
            lessonId: row.assessment.lessonId,
            mode: skill,
            state: 'COMPLETED',
            score,
            submittedAt: finishedAt,
            completedAt: finishedAt,
            response: { answers: choices },
            feedback: { score, correct: correctCount, total: questions.length, details },
          },
        });
        await recordStudy(tx, row.userId);
      });
      const saved = await ownRun(row.id, row.userId);
      ok(res, { attempt: attemptView(saved), result: saved.result });
    };
    router.patch(
      [attempts + '/submit', attempts + '/answers', attempts + '/progress', attempts + '/finish'],
      auth,
      respond,
    );
    router.post([attempts + '/submit', attempts + '/finish'], auth, respond);
  }
  return router;
}
