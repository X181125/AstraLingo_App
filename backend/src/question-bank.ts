import { Router, type RequestHandler } from 'express';
import { Prisma, type PrismaClient, type ContentItem, type LessonAssessment } from '@prisma/client';
import { z } from 'zod';
import { ApiError, ok } from './http.js';
import { generate } from './learning-services.js';
import type { Config } from './config.js';

const key = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const txt = z.string().trim().min(1).max(1000);
const setting = z.object({
  title: txt.max(120).optional(),
  instructions: z.string().max(3000).nullish(),
  timeLimitSec: key.nullish(),
  prepTimeSec: key.nullish(),
  scoringRubricJson: z.json().nullish(),
  isActive: z.boolean().optional(),
});
const option = z.object({ optionText: txt, isCorrect: z.boolean().default(false) });
const input = z.object({
  questionText: txt,
  questionType: z.string().max(60).optional(),
  explanation: z.string().max(1000).nullish(),
  options: z.array(option).max(8).optional(),
  sampleAnswer: z.string().max(3000).nullish(),
  expectedAnswerJson: z.json().nullish(),
  hintsJson: z.json().nullish(),
  orderNo: key.optional(),
  timeLimitSec: key.nullish(),
  prepTimeSec: key.nullish(),
});
const storedOption = option.extend({ id: key });
const storedQuestion = input.extend({
  id: key,
  options: z.array(storedOption),
  answerText: z.string().optional(),
});
type Q = z.infer<typeof storedQuestion>;
type Set = LessonAssessment & { lesson: ContentItem };
const object = (v: Prisma.JsonValue | null): Prisma.JsonObject =>
  v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const span = 100000;
export function bankQuestions(set: LessonAssessment): Q[] {
  const base = set.id * span;
  return (Array.isArray(set.questions) ? set.questions : []).map((value, i) => {
    const raw = object(value),
      q = input.parse(raw),
      id = typeof raw.id === 'number' ? raw.id : base + (i + 1) * 10;
    return {
      ...q,
      id,
      questionType: q.questionType ?? 'MCQ',
      answerText: typeof raw.answerText === 'string' ? raw.answerText : undefined,
      options: (Array.isArray(raw.options) ? raw.options : []).map((item, j) => ({
        ...option.parse(item),
        id: typeof object(item).id === 'number' ? Number(object(item).id) : base + (i + 1) * 10 + j + 1,
      })),
    };
  });
}
function counter(set: LessonAssessment, rows: Q[]) {
  let next = Math.max(
    1000,
    Number(object(set.settings).lastKey ?? 0),
    ...rows.flatMap((q) => [q.id, ...q.options.map((o) => o.id)]).map((id) => id % span),
  );
  return {
    id: () => {
      if (++next >= span) throw new ApiError(409, 'Hãy tạo bộ đề mới.');
      return set.id * span + next;
    },
    last: () => next,
  };
}
function present(row: Set, show: boolean) {
  const questions = bankQuestions(row).map((q) =>
    show
      ? q
      : {
          id: q.id,
          questionType: q.questionType,
          questionText: q.questionText,
          orderNo: q.orderNo,
          options: q.options.map((o) => ({ id: o.id, optionText: o.optionText })),
        },
  );
  return {
    ...object(row.settings),
    id: row.id,
    assessmentId: row.id,
    promptId: row.lesson.publicId,
    audioId: row.lesson.publicId,
    title: row.title,
    isActive: row.isActive,
    createdAt: row.createdAt,
    questions,
    questionCount: questions.length,
  };
}

export function questionBank(db: PrismaClient, config: Config, auth: RequestHandler, limit: RequestHandler) {
  const router = Router();
  for (const kind of ['speaking', 'listening'] as const) {
    const skill = kind === 'speaking' ? 'SPEAKING' : 'LISTENING';
    const base = '/' + kind + '-assessments/:id',
      qpath = '/' + kind + '-questions/:id';
    async function get(raw: unknown, userId: string, owner: boolean) {
      const row = await db.lessonAssessment.findFirst({
        where: {
          id: key.parse(raw),
          lesson: {
            contentType: skill,
            course: { language: 'en' },
            ...(owner
              ? { ownerId: userId }
              : {
                  OR: [{ ownerId: userId }, { status: 'PUBLISHED', OR: [{ isPublic: true }, { ownerId: null }] }],
                }),
          },
        },
        include: { lesson: true },
      });
      if (!row) throw new ApiError(404, 'Không tìm thấy bộ đề.');
      return row;
    }
    async function edit(row: Set, mutate: (rows: Q[], seq: ReturnType<typeof counter>) => unknown) {
      return db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "LessonAssessment" WHERE id=${row.id} FOR UPDATE`;
        const current = await tx.lessonAssessment.findUniqueOrThrow({ where: { id: row.id } }),
          rows = bankQuestions(current),
          seq = counter(current, rows);
        const result = mutate(rows, seq);
        if (rows.length > 40 || rows.some((q) => q.options.length > 8))
          throw new ApiError(400, 'Mỗi bộ đề tối đa 40 câu, mỗi câu 8 lựa chọn.');
        await tx.lessonAssessment.update({
          where: { id: row.id },
          data: {
            questions: JSON.parse(JSON.stringify(rows)),
            settings: { ...object(current.settings), lastKey: seq.last() } as Prisma.InputJsonObject,
          },
        });
        return result;
      });
    }
    const missing = () => new ApiError(404, 'Không tìm thấy câu hỏi hoặc lựa chọn.');
    const byQuestion = (rows: Q[], id: number) => {
      const q = rows.find((q) => q.id === id);
      if (!q) throw missing();
      return q;
    };
    router.get(base + '/questions', auth, async (req, res) => {
      const row = await get(req.params.id, res.locals.user.id, false);
      ok(res, present(row, row.lesson.ownerId === res.locals.user.id).questions);
    });
    router.post(base + '/questions', auth, async (req, res) => {
      const row = await get(req.params.id, res.locals.user.id, true),
        v = input.parse(req.body);
      const q = await edit(row, (rows, seq) => {
        const q = {
          ...v,
          id: seq.id(),
          questionType: v.questionType ?? (kind === 'speaking' ? 'OPEN' : 'MCQ'),
          options: (v.options ?? []).map((o) => ({ ...o, id: seq.id() })),
        };
        rows.push(q);
        return q;
      });
      ok(res, q, 201);
    });
    router.get(qpath, auth, async (req, res) => {
      const id = key.parse(req.params.id),
        row = await get(Math.floor(id / span), res.locals.user.id, false);
      const q = present(row, row.lesson.ownerId === res.locals.user.id).questions.find((q) => q.id === id);
      if (!q) throw missing();
      ok(res, q);
    });
    router.patch([qpath, qpath + '/reorder'], auth, async (req, res) => {
      const id = key.parse(req.params.id),
        row = await get(Math.floor(id / span), res.locals.user.id, true),
        v = input.partial().parse(req.body);
      const updated = await edit(row, (rows, seq) => {
        const q = byQuestion(rows, id),
          { options, ...rest } = v;
        Object.assign(q, rest);
        if (options) q.options = options.map((o) => ({ ...o, id: seq.id() }));
        if (v.orderNo) {
          rows.splice(rows.indexOf(q), 1);
          rows.splice(Math.min(rows.length, v.orderNo - 1), 0, q);
          rows.forEach((item, i) => (item.orderNo = i + 1));
        }
        return q;
      });
      ok(res, updated);
    });
    router.delete(qpath, auth, async (req, res) => {
      const id = key.parse(req.params.id),
        row = await get(Math.floor(id / span), res.locals.user.id, true);
      await edit(row, (rows) => rows.splice(rows.indexOf(byQuestion(rows, id)), 1));
      ok(res, { id, deleted: true });
    });
    if (kind === 'listening') {
      router.post(qpath + '/options', auth, async (req, res) => {
        const id = key.parse(req.params.id),
          row = await get(Math.floor(id / span), res.locals.user.id, true),
          v = option.parse(req.body);
        ok(
          res,
          await edit(row, (rows, seq) => {
            const q = byQuestion(rows, id),
              o = { ...v, id: seq.id() };
            if (v.isCorrect) q.options.forEach((x) => (x.isCorrect = false));
            q.options.push(o);
            return o;
          }),
          201,
        );
      });
      const options = '/listening-question-options/:id';
      const changeOption: RequestHandler = async (req, res) => {
        const id = key.parse(req.params.id),
          row = await get(Math.floor(id / span), res.locals.user.id, true);
        const value = await edit(row, (rows) => {
          const q = rows.find((q) => q.options.some((o) => o.id === id)),
            o = q?.options.find((o) => o.id === id);
          if (!q || !o) throw missing();
          if (req.method === 'DELETE') {
            q.options.splice(q.options.indexOf(o), 1);
            return { deleted: true };
          }
          const patch = option.partial().parse(req.body);
          if (patch.isCorrect) q.options.forEach((x) => (x.isCorrect = false));
          Object.assign(o, patch);
          return o;
        });
        ok(res, value);
      };
      router.patch(options, auth, changeOption);
      router.delete(options, auth, changeOption);
      router.post(
        [qpath + '/regenerate-options', base + '/questions/regenerate'],
        auth,
        limit,
        async (req, res) => {
          const id = key.parse(req.params.id),
            single = req.path.endsWith('/regenerate-options'),
            row = await get(single ? Math.floor(id / span) : id, res.locals.user.id, true);
          const prompt = single ? byQuestion(bankQuestions(row), id).questionText : row.lesson.preview;
          const generated = (
            await generate(config, 'questions', prompt + '\n' + String(object(row.lesson.practice).body ?? ''))
          ).questions;
          const value = await edit(row, (rows, seq) => {
            const mapped = generated.map((q) => ({
              id: seq.id(),
              questionText: q.prompt,
              questionType: 'MCQ',
              explanation: q.explanation,
              options: q.options.map((optionText, i) => ({ optionText, isCorrect: i === q.answer, id: seq.id() })),
            }));
            if (single) {
              const q = byQuestion(rows, id);
              q.options = mapped[0].options;
              q.questionText = mapped[0].questionText;
              return q;
            }
            rows.splice(0, rows.length, ...mapped);
            return rows;
          });
          ok(res, value);
        },
      );
      continue;
    }
    const prompts = '/speaking-prompts/:id';
    async function speaking(raw: unknown, userId: string, owner: boolean) {
      const row = await db.contentItem.findFirst({
        where: {
          publicId: key.parse(raw),
          contentType: 'SPEAKING',
          course: { language: 'en' },
          ...(owner
            ? { ownerId: userId }
            : { OR: [{ ownerId: userId }, { status: 'PUBLISHED', OR: [{ ownerId: null }, { isPublic: true }] }] }),
        },
      });
      if (!row) throw new ApiError(404, 'Không tìm thấy đề nói.');
      return row;
    }
    router.get(
      [
        prompts + '/assessments',
        prompts + '/assessments/active',
        prompts + '/assessments/latest',
        prompts + '/active-assessment',
      ],
      auth,
      async (req, res) => {
        const item = await speaking(req.params.id, res.locals.user.id, false);
        const rows = await db.lessonAssessment.findMany({
          where: { lessonId: item.id },
          orderBy: { id: 'desc' },
          include: { lesson: true },
        });
        const all = rows.map((r) => present(r, r.lesson.ownerId === res.locals.user.id));
        ok(
          res,
          req.path.endsWith('/assessments')
            ? all
            : req.path.endsWith('/latest')
              ? (all[0] ?? null)
              : (all.find((a) => a.isActive) ?? null),
        );
      },
    );
    router.post(prompts + '/assessments', auth, async (req, res) => {
      const item = await speaking(req.params.id, res.locals.user.id, true),
        v = setting.parse(req.body);
      const row = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "ContentItem" WHERE id=${item.id} FOR UPDATE`;
        if (v.isActive)
          await tx.lessonAssessment.updateMany({
            where: { lessonId: item.id, isActive: true },
            data: { isActive: false },
          });
        return tx.lessonAssessment.create({
          data: {
            lessonId: item.id,
            title: v.title ?? item.title,
            settings: v,
            questions: [],
            isActive: v.isActive ?? false,
          },
          include: { lesson: true },
        });
      });
      ok(res, present(row, true), 201);
    });
    router.get([base, base + '/review-data', base + '/answer-key'], auth, async (req, res) => {
      const row = await get(req.params.id, res.locals.user.id, req.path.endsWith('/answer-key'));
      ok(res, present(row, row.lesson.ownerId === res.locals.user.id));
    });
    router.patch([base, base + '/activate', base + '/deactivate'], auth, async (req, res) => {
      const row = await get(req.params.id, res.locals.user.id, true),
        v = setting.parse(req.body ?? {});
      const active = req.path.endsWith('/activate') ? true : req.path.endsWith('/deactivate') ? false : v.isActive;
      const updated = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "ContentItem" WHERE id=${row.lessonId} FOR UPDATE`;
        if (active)
          await tx.lessonAssessment.updateMany({
            where: { lessonId: row.lessonId, isActive: true },
            data: { isActive: false },
          });
        return tx.lessonAssessment.update({
          where: { id: row.id },
          data: {
            title: v.title,
            isActive: active,
            settings: { ...object(row.settings), ...v } as Prisma.InputJsonObject,
          },
          include: { lesson: true },
        });
      });
      ok(res, present(updated, true));
    });
    router.post(base + '/duplicate', auth, async (req, res) => {
      const row = await get(req.params.id, res.locals.user.id, true);
      const questions = bankQuestions(row).map(({ id, options, ...q }) => ({
        ...q,
        options: options.map(({ id, ...o }) => o),
      }));
      const copied = await db.lessonAssessment.create({
        data: {
          lessonId: row.lessonId,
          title: (row.title + ' · Bản sao').slice(0, 120),
          questions,
          settings: object(row.settings) as Prisma.InputJsonObject,
        },
        include: { lesson: true },
      });
      ok(res, present(copied, true), 201);
    });
    router.delete(base, auth, async (req, res) => {
      const row = await get(req.params.id, res.locals.user.id, true);
      await db.lessonAssessment.delete({ where: { id: row.id } });
      ok(res, { deleted: true });
    });
  }
  return router;
}
