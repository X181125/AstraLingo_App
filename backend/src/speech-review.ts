import { trackAi } from './ai-audit.js';
import { Router, type RequestHandler } from 'express';
import { Prisma, type PrismaClient, type SpeechSegment } from '@prisma/client';
import { z } from 'zod';
import { ok, ApiError } from './http.js';
import { generate } from './learning-services.js';
import { readAudio } from './study.js';
import type { Config } from './config.js';

const id = z.coerce.number().int().positive().max(2147483647);
const obj = (v: Prisma.JsonValue | null): Prisma.JsonObject =>
  v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const segmentFields = z.object({
  text: z.string().max(1500).optional(),
  normalizedText: z.string().max(1500).nullish(),
  startSec: z.number().nonnegative().nullish(),
  endSec: z.number().nonnegative().nullish(),
  issueType: z.string().max(60).optional(),
  message: z.string().max(1500).optional(),
  suggestion: z.string().max(1500).nullish(),
  segmentIndex: z.number().int().nonnegative().optional(),
});
function segment(row: SpeechSegment, attemptId: number) {
  return { ...obj(row.data), id: row.id, attemptId, segmentIndex: row.sequence };
}

export function speechReviewRoutes(db: PrismaClient, config: Config, auth: RequestHandler, limit: RequestHandler) {
  const router = Router(),
    attempt = '/speaking-attempts/:id',
    submission = '/speaking-submissions/:id';
  async function owned(raw: unknown, userId: string) {
    const a = await db.studyAttempt.findFirst({
      where: { publicId: id.parse(raw), userId, mode: 'SPEAKING' },
      include: { lesson: true },
    });
    if (!a) throw new ApiError(404, 'Không tìm thấy bài nói.');
    return a;
  }
  async function saveResponse(a: Awaited<ReturnType<typeof owned>>, data: Prisma.JsonObject, state?: string) {
    const n = await db.studyAttempt.updateMany({
      where: { id: a.id, updatedAt: a.updatedAt, state: a.state },
      data: { state, response: data as Prisma.InputJsonObject },
    });
    if (!n.count) throw new ApiError(409, 'Bài đã thay đổi. Hãy mở lại.');
  }
  router.patch(attempt + '/transcript', auth, async (req, res) => {
    const a = await owned(req.params.id, res.locals.user.id);
    if (a.state !== 'DRAFT') throw new ApiError(409, 'Bài đã nộp.');
    const { transcript } = z.object({ transcript: z.string().trim().max(15000) }).parse(req.body);
    await saveResponse(a, { ...obj(a.response), transcript, text: transcript });
    ok(res, { attemptId: a.publicId, transcript });
  });
  router.post([attempt + '/retry', attempt + '/resume', attempt + '/abandon'], auth, async (req, res) => {
    const a = await owned(req.params.id, res.locals.user.id);
    if (req.path.endsWith('/retry')) {
      const row = await db.studyAttempt.create({
        data: { userId: a.userId, lessonId: a.lessonId, mode: 'SPEAKING', state: 'DRAFT', response: {} },
      });
      return ok(res, { id: row.publicId, promptId: a.lesson.publicId, status: row.state }, 201);
    }
    if (a.state !== 'DRAFT') throw new ApiError(409, 'Lượt làm đã đóng.');
    const status = req.path.endsWith('/abandon') ? 'ABANDONED' : 'DRAFT';
    if (status === 'ABANDONED') await saveResponse(a, obj(a.response), status);
    ok(res, {
      id: a.publicId,
      status,
      promptId: a.lesson.publicId,
      transcript: obj(a.response).transcript ?? null,
    });
  });
  router.patch(submission + '/final-attempt', auth, async (req, res) => {
    const a = await owned(req.params.id, res.locals.user.id),
      chosen = await owned(req.body?.finalAttemptId ?? req.body?.attemptId, a.userId);
    if (a.state !== 'DRAFT' || a.lessonId !== chosen.lessonId || !obj(chosen.response).audioId)
      throw new ApiError(409, 'Chọn lượt có bản ghi của cùng đề bài.');
    await saveResponse(a, {
      ...obj(a.response),
      finalAttemptId: chosen.publicId,
      audioId: obj(chosen.response).audioId,
      transcript: obj(chosen.response).transcript ?? null,
    });
    ok(res, { submissionId: a.publicId, finalAttemptId: chosen.publicId });
  });
  router.get(
    [submission + '/attempts', submission + '/transcript', submission + '/final-recording'],
    auth,
    async (req, res) => {
      const a = await owned(req.params.id, res.locals.user.id),
        response = obj(a.response);
      if (req.path.endsWith('/attempts')) {
        const rows = await db.studyAttempt.findMany({
          where: { userId: a.userId, lessonId: a.lessonId, mode: 'SPEAKING' },
          orderBy: { publicId: 'desc' },
        });
        return ok(res, {
          submissionId: a.publicId,
          attempts: rows.map((r) => ({
            id: r.publicId,
            status: r.state,
            overallScore: r.score,
            startedAt: r.createdAt,
          })),
        });
      }
      if (req.path.endsWith('/transcript'))
        return ok(res, {
          submissionId: a.publicId,
          transcript: response.transcript ?? response.text ?? null,
          segments: response.segments ?? [],
        });
      const m =
        typeof response.audioId === 'string'
          ? await db.studyMedia.findFirst({
              where: { id: response.audioId, ownerId: a.userId },
              select: { id: true, mimeType: true },
            })
          : null;
      ok(res, { submissionId: a.publicId, recording: m ? { ...m, audioUrl: '/api/study/audio/' + m.id } : null });
    },
  );
  for (const kind of ['transcript', 'feedback'] as const) {
    const collection = attempt + '/' + kind + '-segments',
      entity = '/speaking-' + kind + '-segments/:id';
    async function lookup(raw: unknown, userId: string) {
      const row = await db.speechSegment.findFirst({
        where: { id: id.parse(raw), kind, attempt: { userId, mode: 'SPEAKING' } },
        include: { attempt: true },
      });
      if (!row) throw new ApiError(404, 'Không tìm thấy đoạn ghi âm.');
      return row;
    }
    router.get(collection, auth, async (req, res) => {
      const a = await owned(req.params.id, res.locals.user.id);
      const rows = await db.speechSegment.findMany({
        where: { attemptId: a.id, kind },
        orderBy: [{ sequence: 'asc' }, { id: 'asc' }],
      });
      ok(res, {
        attemptId: a.publicId,
        segments: rows.map((r) => segment(r, a.publicId)),
        transcript: obj(a.response).transcript ?? null,
      });
    });
    router.post([collection + '/generate', collection + '/regenerate'], auth, limit, async (req, res) => {
      const a = await owned(req.params.id, res.locals.user.id),
        audioId = obj(a.response).audioId;
      if (typeof audioId !== 'string') throw new ApiError(409, 'Chưa lưu bản ghi.');
      if (!req.path.endsWith('/regenerate')) {
        const rows = await db.speechSegment.findMany({
          where: { attemptId: a.id, kind },
          orderBy: { sequence: 'asc' },
        });
        if (rows.length)
          return ok(res, {
            attemptId: a.publicId,
            segments: rows.map((r) => segment(r, a.publicId)),
            transcript: obj(a.response).transcript ?? null,
          });
      }
      const audio = await readAudio(db, config, audioId);
      const lines =
        kind === 'transcript'
          ? (await generate(trackAi(config, db, res.locals.user.id, 'speaking.transcription'), 'transcription', 'Transcribe this English recording.', audio)).segments
          : (await generate(trackAi(config, db, res.locals.user.id, 'speaking.notes'), 'speech-notes', a.lesson.preview, audio)).segments;
      const transcript =
        kind === 'transcript' ? lines.map((x) => ('text' in x ? x.text : '')).join(' ') : undefined;
      const stored = await db.$transaction(async (tx) => {
        const changed = await tx.studyAttempt.updateMany({
          where: { id: a.id, updatedAt: a.updatedAt },
          data: {
            updatedAt: new Date(),
            ...(kind === 'transcript' && {
              response: { ...obj(a.response), transcript, segments: lines } as Prisma.InputJsonObject,
            }),
          },
        });
        if (!changed.count) throw new ApiError(409, 'Bản ghi đã thay đổi.');
        await tx.speechSegment.deleteMany({ where: { attemptId: a.id, kind } });
        if (lines.length)
          await tx.speechSegment.createMany({
            data: lines.map((data, sequence) => ({ attemptId: a.id, kind, sequence, data })),
          });
        return tx.speechSegment.findMany({ where: { attemptId: a.id, kind }, orderBy: { sequence: 'asc' } });
      });
      ok(res, {
        attemptId: a.publicId,
        segments: stored.map((s) => segment(s, a.publicId)),
        transcript: transcript ?? null,
      });
    });
    router.get(entity, auth, async (req, res) => {
      const row = await lookup(req.params.id, res.locals.user.id);
      ok(res, segment(row, row.attempt.publicId));
    });
    const change: RequestHandler = async (req, res) => {
      const row = await lookup(req.params.id, res.locals.user.id),
        data = segmentFields.partial().parse(req.body ?? {});
      const merged = { ...obj(row.data), ...data };
      if (
        typeof merged.endSec === 'number' &&
        typeof merged.startSec === 'number' &&
        merged.endSec < merged.startSec
      )
        throw new ApiError(400, 'Mốc kết thúc phải sau mốc bắt đầu.');
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "StudyAttempt" WHERE id=${row.attemptId} FOR UPDATE`;
        if (req.method === 'DELETE') await tx.speechSegment.delete({ where: { id: row.id } });
        else
          await tx.speechSegment.update({
            where: { id: row.id },
            data: { sequence: data.segmentIndex, data: merged as Prisma.InputJsonObject },
          });
        if (kind === 'transcript') {
          const all = await tx.speechSegment.findMany({
            where: { attemptId: row.attemptId, kind },
            orderBy: [{ sequence: 'asc' }, { id: 'asc' }],
          });
          const a = await tx.studyAttempt.findUniqueOrThrow({ where: { id: row.attemptId } });
          await tx.studyAttempt.update({
            where: { id: a.id },
            data: {
              response: {
                ...obj(a.response),
                transcript: all.map((r) => obj(r.data).text).join(' '),
                segments: all.map((r) => r.data),
              } as Prisma.InputJsonObject,
            },
          });
        }
      });
      ok(
        res,
        req.method === 'DELETE'
          ? { deleted: true, id: row.id }
          : segment(await lookup(row.id, res.locals.user.id), row.attempt.publicId),
      );
    };
    router.patch(entity, auth, change);
    router.delete(entity, auth, change);
  }
  for (const issue of ['pronunciation', 'fluency', 'grammar', 'vocabulary']) {
    router.get(attempt + '/issues/' + issue, auth, async (req, res) => {
      const a = await owned(req.params.id, res.locals.user.id);
      const rows = await db.speechSegment.findMany({
        where: { attemptId: a.id, kind: 'feedback', data: { path: ['issueType'], equals: issue } },
        orderBy: { sequence: 'asc' },
      });
      ok(res, { attemptId: a.publicId, issueType: issue, issues: rows.map((r) => segment(r, a.publicId)) });
    });
  }
  return router;
}
