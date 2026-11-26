import { ContentType, Prisma, type PrismaClient } from '@prisma/client';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { ApiError, ok } from './http.js';
import { generate } from './learning-services.js';
import { recordStudy, readAudio } from './study.js';
import type { Config } from './config.js';

const numeric = z.coerce.number().int().positive().max(2147483647);
const draft = z.object({
  originalText: z.string().trim().max(15000).optional(),
  audioId: z.string().max(128).optional(),
});
const full = { lesson: true } as const;
type Submission = Prisma.StudyAttemptGetPayload<{ include: typeof full }>;
const json = (v: Prisma.JsonValue | null): Prisma.JsonObject =>
  v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const toPrompt = (lesson: Submission['lesson']) => ({
  id: lesson.publicId,
  promptText: json(lesson.practice).body ?? lesson.preview,
  constraintsJson: json(lesson.detail).constraintsJson ?? null,
  sampleAnswer: json(lesson.detail).sampleAnswer ?? null,
  contentItemId: lesson.publicId,
  contentItem: {
    id: lesson.publicId,
    title: lesson.title,
    description: lesson.description ?? lesson.preview,
    isPublic: lesson.isPublic,
    status: lesson.status,
  },
});
function view(row: Submission) {
  const response = json(row.response),
    feedback = json(row.feedback);
  return {
    id: row.publicId,
    attemptId: row.id,
    userId: row.userId,
    promptId: row.lesson.publicId,
    status: row.state,
    originalText: response.text ?? null,
    audioId: response.audioId ?? null,
    feedbackJson: row.feedback,
    feedbackText: Array.isArray(feedback.strengths) ? feedback.strengths.join('\n') : null,
    score: row.score,
    createdAt: row.createdAt,
    submittedAt: row.submittedAt,
    completedAt: row.completedAt,
    prompt: toPrompt(row.lesson),
  };
}

export function submissionRoutes(db: PrismaClient, config: Config, auth: RequestHandler, aiLimit: RequestHandler) {
  const router = Router();
  for (const skill of ['writing', 'speaking'] as const) {
    const mode = skill === 'writing' ? ContentType.WRITING : ContentType.SPEAKING;
    const prompts = '/' + skill + '-prompts/:id',
      submissions = '/' + skill + '-submissions/:id';
    const attemptPath = '/speaking-attempts/:id';
    const visible = (userId: string): Prisma.ContentItemWhereInput => ({
      contentType: mode,
      course: { language: 'en' },
      OR: [{ ownerId: userId }, { status: 'PUBLISHED', OR: [{ isPublic: true }, { ownerId: null }] }],
    });
    async function prompt(param: unknown, userId: string) {
      const result = await db.contentItem.findFirst({
        where: { publicId: numeric.parse(param), ...visible(userId) },
      });
      if (!result) throw new ApiError(404, 'Không tìm thấy đề bài.');
      return result;
    }
    async function owned(param: unknown, userId: string) {
      const row = await db.studyAttempt.findFirst({
        where: { publicId: numeric.parse(param), userId, mode },
        include: full,
      });
      if (!row) throw new ApiError(404, 'Không tìm thấy bài nộp.');
      return row;
    }
    async function changes(value: unknown, userId: string) {
      const { originalText: text, audioId } = draft.parse(value ?? {});
      if (
        audioId &&
        (mode !== 'SPEAKING' || !(await db.studyMedia.count({ where: { id: audioId, ownerId: userId } })))
      )
        throw new ApiError(400, 'Bản ghi không hợp lệ.');
      return { ...(text === undefined ? {} : { text }), ...(audioId && { audioId }) };
    }
    router.get(prompts + '/related', auth, async (req, res) => {
      const base = await prompt(req.params.id, res.locals.user.id);
      const rows = await db.contentItem.findMany({
        where: { ...visible(res.locals.user.id), id: { not: base.id } },
        orderBy: { order: 'asc' },
        take: numeric.max(50).default(6).parse(req.query.limit),
      });
      ok(res, { basePrompt: toPrompt(base), items: rows.map(toPrompt) });
    });
    router.get([prompts + '/submissions/mine', prompts + '/my-latest-submission'], auth, async (req, res) => {
      const item = await prompt(req.params.id, res.locals.user.id);
      const where = { lessonId: item.id, userId: res.locals.user.id, mode };
      const { page, limit } = z
        .object({ page: numeric.max(100000).default(1), limit: numeric.max(100).default(20) })
        .parse(req.query);
      const latest = req.path.endsWith('/my-latest-submission');
      const [rows, total] = await db.$transaction([
        db.studyAttempt.findMany({
          where,
          include: full,
          orderBy: [{ updatedAt: 'desc' }, { publicId: 'desc' }],
          take: latest ? 1 : limit,
          skip: latest ? 0 : (page - 1) * limit,
        }),
        db.studyAttempt.count({ where }),
      ]);
      ok(
        res,
        latest
          ? rows[0]
            ? view(rows[0])
            : null
          : { items: rows.map(view), total, page, limit, totalPages: Math.ceil(total / limit) },
      );
    });
    router.post(
      skill === 'speaking' ? [prompts + '/submissions', prompts + '/attempts'] : prompts + '/submissions',
      auth,
      async (req, res) => {
        const item = await prompt(req.params.id, res.locals.user.id);
        if (item.status !== 'PUBLISHED') throw new ApiError(409, 'Đề bài chưa xuất bản.');
        const response = await changes(req.body, res.locals.user.id);
        ok(
          res,
          view(
            await db.studyAttempt.create({
              data: { userId: res.locals.user.id, lessonId: item.id, mode, state: 'DRAFT', response },
              include: full,
            }),
          ),
          201,
        );
      },
    );
    router.get(
      [submissions, submissions + '/result', submissions + '/status', submissions + '/ai/status'],
      auth,
      async (req, res) => {
        const row = await owned(req.params.id, res.locals.user.id);
        ok(res, { ...view(row), submissionId: row.publicId, submissionStatus: row.state, aiStatus: row.state });
      },
    );
    const edit: RequestHandler = async (req, res) => {
      const row = await owned(req.params.id, res.locals.user.id);
      const patch = await changes(req.body, res.locals.user.id);
      const current = await db.studyAttempt.updateMany({
        where: { id: row.id, state: 'DRAFT', updatedAt: row.updatedAt },
        data: { response: { ...json(row.response), ...patch } as Prisma.InputJsonObject },
      });
      if (!current.count) throw new ApiError(409, 'Bản nháp đã thay đổi. Tải lại trước khi sửa.');
      ok(res, view(await owned(row.publicId, res.locals.user.id)));
    };
    router.patch(submissions, auth, edit);
    router.put(submissions, auth, edit);
    const submit: RequestHandler = async (req, res) => {
      const row = await owned(req.params.id, res.locals.user.id);
      if (row.state !== 'DRAFT') return ok(res, view(row));
      const patch = await changes(req.body, res.locals.user.id);
      const response = { ...json(row.response), ...patch, assignment: String(toPrompt(row.lesson).promptText) };
      if (row.lesson.status !== 'PUBLISHED' || !(mode === 'WRITING' ? response.text : response.audioId))
        throw new ApiError(400, 'Hãy hoàn tất bài trước khi nộp.');
      await db.$transaction(async (tx) => {
        const updated = await tx.studyAttempt.updateMany({
          where: { id: row.id, state: 'DRAFT', updatedAt: row.updatedAt },
          data: { state: 'SUBMITTED', submittedAt: new Date(), response: response as Prisma.InputJsonObject },
        });
        if (!updated.count) throw new ApiError(409, 'Bài đã thay đổi.');
        await recordStudy(tx, row.userId);
      });
      ok(res, view(await owned(row.publicId, res.locals.user.id)));
    };
    router.post(submissions + '/submit', auth, submit);
    router.patch(submissions + '/submit', auth, submit);
    if (skill === 'speaking') {
      router.post([attemptPath + '/submit', attemptPath + '/finish'], auth, submit);
      router.patch([attemptPath + '/submit', attemptPath + '/finish'], auth, submit);
      router.patch(attemptPath + '/progress', auth, edit);
      router.get(prompts + '/attempts/mine', auth, async (req, res) => {
        const item = await prompt(req.params.id, res.locals.user.id);
        const rows = await db.studyAttempt.findMany({
          where: { mode, userId: res.locals.user.id, lessonId: item.id },
          orderBy: { updatedAt: 'desc' },
          take: 100,
          include: full,
        });
        ok(res, { promptId: item.publicId, attempts: rows.map(view) });
      });
      router.get(
        [
          attemptPath,
          attemptPath + '/resume',
          attemptPath + '/resume-check',
          attemptPath + '/result',
          attemptPath + '/review',
          attemptPath + '/score-breakdown',
          attemptPath + '/feedback',
        ],
        auth,
        async (req, res) => {
          const row = await owned(req.params.id, res.locals.user.id);
          ok(res, {
            ...view(row),
            attempt: view(row),
            canResume: row.state === 'DRAFT',
            overallScore: row.score,
            feedback: row.feedback,
          });
        },
      );
      router.get(
        [
          attemptPath + '/transcript',
          attemptPath + '/transcript-segments',
          attemptPath + '/feedback-segments',
          attemptPath + '/timeline',
        ],
        auth,
        async (req, res) => {
          const row = await owned(req.params.id, res.locals.user.id);
          const segments = json(row.response).segments ?? [];
          const feedbackSegments = json(row.feedback).segments ?? [];
          ok(res, {
            attemptId: row.publicId,
            transcript: json(row.response).transcript ?? null,
            segments: req.path.endsWith('feedback-segments') ? feedbackSegments : segments,
            feedbackSegments,
          });
        },
      );
    }
    router.delete(submissions, auth, async (req, res) => {
      const row = await owned(req.params.id, res.locals.user.id);
      const changed = await db.studyAttempt.deleteMany({ where: { id: row.id, state: 'DRAFT' } });
      if (!changed.count) throw new ApiError(409, 'Chỉ có thể xóa bản nháp.');
      ok(res, { deleted: true });
    });
    router.post([submissions + '/duplicate', submissions + '/reopen-as-draft'], auth, async (req, res) => {
      const row = await owned(req.params.id, res.locals.user.id),
        { text, audioId } = json(row.response);
      const response = {
        ...(typeof text === 'string' && { text }),
        ...(typeof audioId === 'string' && { audioId }),
      };
      ok(
        res,
        view(
          await db.studyAttempt.create({
            data: { userId: row.userId, lessonId: row.lessonId, mode: row.mode, state: 'DRAFT', response },
            include: full,
          }),
        ),
        201,
      );
    });
    router.post([submissions + '/retry-ai', submissions + '/ai/evaluate'], auth, aiLimit, async (req, res) => {
      const row = await owned(req.params.id, res.locals.user.id);
      if (row.state === 'COMPLETED') return ok(res, view(row));
      if (row.state !== 'SUBMITTED') throw new ApiError(409, 'Hãy nộp bài trước khi chấm.');
      const data = json(row.response);
      const media =
        mode === 'SPEAKING' && typeof data.audioId === 'string'
          ? await readAudio(db, config, data.audioId)
          : undefined;
      if (mode === 'SPEAKING' && !media) throw new ApiError(400, 'Thiếu bản ghi âm.');
      const feedback = await generate(
        config,
        mode === 'WRITING' ? 'writing-feedback' : 'speaking-feedback',
        `Assignment: ${data.assignment ?? toPrompt(row.lesson).promptText}\nResponse: ${data.text ?? ''}`,
        media,
      );
      await db.studyAttempt.updateMany({
        where: { id: row.id, state: 'SUBMITTED' },
        data: { state: 'COMPLETED', completedAt: new Date(), score: feedback.score, feedback },
      });
      ok(res, view(await owned(row.publicId, res.locals.user.id)));
    });
    router.get(
      [
        submissions + '/feedback',
        submissions + '/ai/feedback',
        submissions + '/score-breakdown',
        submissions + '/ai/rubric',
      ],
      auth,
      async (req, res) => {
        const row = await owned(req.params.id, res.locals.user.id);
        if (row.state !== 'COMPLETED') throw new ApiError(409, 'Chưa có kết quả chấm bài.');
        const feedback = json(row.feedback);
        ok(res, {
          ...feedback,
          submissionId: row.publicId,
          submissionStatus: row.state,
          overallScore: row.score,
          scale: '0–100',
          generatedAt: row.completedAt,
        });
      },
    );
  }
  return router;
}
