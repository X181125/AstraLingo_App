import express, { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { Prisma, type PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { ApiError, ok } from './http.js';
import { readAudio, storeAudio } from './study.js';
import type { Config } from './config.js';

const key = z.coerce.number().int().positive().max(2147483647);
const mime = z.enum([
  'audio/mpeg',
  'audio/wav',
  'audio/mp4',
  'audio/ogg',
  'audio/webm',
  'audio/m4a',
  'audio/x-m4a',
]);
const details = z.object({
  source: z.string().trim().max(40).default('MICROPHONE'),
  durationSec: z.number().nonnegative().max(3600).nullable().optional(),
  waveformJson: z.array(z.number().finite()).max(2048).nullable().optional(),
  isPrimary: z.boolean().optional(),
});
const object = (v: Prisma.JsonValue): Prisma.JsonObject =>
  v && typeof v === 'object' && !Array.isArray(v) ? v : {};
export function recordingRoutes(
  db: PrismaClient,
  config: Config,
  auth: RequestHandler,
  mediaLimit: RequestHandler,
) {
  const router = Router();
  function ticket(id: number | string, purpose: 'upload' | 'read') {
    return jwt.sign({ purpose }, config.JWT_SECRET, {
      algorithm: 'HS256',
      audience: 'astra-media',
      issuer: 'astralingo',
      subject: String(id),
      expiresIn: '5m',
    });
  }
  function verify(raw: unknown, id: number | string, purpose: string) {
    try {
      const v = jwt.verify(z.string().max(1024).parse(raw), config.JWT_SECRET, {
        audience: 'astra-media',
        issuer: 'astralingo',
        algorithms: ['HS256'],
      });
      if (typeof v === 'object' && v.sub === String(id) && v.purpose === purpose) return;
    } catch {}
    throw new ApiError(403, 'Liên kết đã hết hạn hoặc không hợp lệ.');
  }
  const upload = multer({
    limits: { files: 1, fields: 3, fileSize: 4194304 },
    storage: multer.memoryStorage(),
  }).single('file');
  router.post(
    '/content-items/upload-audio',
    auth,
    mediaLimit,
    (req, res, next) =>
      upload(req, res, (e) => (e ? next(new ApiError(400, 'Cần một tệp audio tối đa 4 MB.')) : next())),
    async (req, res) => {
      if (!req.file) throw new ApiError(400, 'Chọn tệp âm thanh.');
      const m = mime.parse(req.file.mimetype),
        item = await storeAudio(db, config, res.locals.user.id, m, Buffer.from(req.file.buffer));
      ok(
        res,
        {
          id: item.id,
          path: item.id,
          audioUrl: '/api/media/content/' + item.id,
          mimeType: m,
          size: req.file.size,
          originalName: req.file.originalname,
        },
        201,
      );
    },
  );
  router.get('/media/content/:id', async (req, res) => {
    const id = z.string().max(128).parse(req.params.id);
    const visible = await db.contentItem.count({
      where: {
        course: { language: 'en' },
        status: 'PUBLISHED',
        OR: [{ isPublic: true }, { ownerId: null }],
        practice: { path: ['audioId'], equals: id },
      },
    });
    if (!visible) throw new ApiError(404, 'Bản ghi không công khai.');
    const file = await readAudio(db, config, id);
    res.type(file.mimeType).send(Buffer.from(file.data, 'base64'));
  });
  const base = '/speaking-attempts/:id/recordings',
    single = '/speaking-recordings/:id';
  const clipInclude = { attempt: true, media: { select: { id: true, mimeType: true } } } as const;
  type Clip = Prisma.SpeechClipGetPayload<{ include: typeof clipInclude }>;
  async function owned(raw: unknown, userId: string) {
    const item = await db.speechClip.findFirst({
      where: { id: key.parse(raw), attempt: { userId, mode: 'SPEAKING' } },
      include: clipInclude,
    });
    if (!item) throw new ApiError(404, 'Không tìm thấy bản ghi.');
    return item;
  }
  async function attempt(raw: unknown, userId: string, write = false) {
    const row = await db.studyAttempt.findFirst({ where: { publicId: key.parse(raw), mode: 'SPEAKING', userId } });
    if (!row) throw new ApiError(404, 'Không tìm thấy lượt luyện nói.');
    if (write && row.state !== 'DRAFT') throw new ApiError(409, 'Bài nộp đã khóa.');
    return row;
  }
  const stream = (c: Clip) => '/api/speech-media/' + c.id + '?ticket=' + ticket(c.id, 'read');
  function view(c: Clip) {
    return {
      id: c.id,
      attemptId: c.attempt.publicId,
      userId: c.attempt.userId,
      source: c.source,
      audioUrl: c.mediaId ? stream(c) : null,
      mimeType: c.mimeType,
      durationSec: c.durationSec,
      waveformJson: c.waveform,
      isPrimary: !!c.mediaId && object(c.attempt.response).audioId === c.mediaId,
      createdAt: c.createdAt,
    };
  }
  async function select(c: Clip, force: boolean) {
    if (!c.mediaId) throw new ApiError(409, 'Tải tệp trước khi chọn bản ghi.');
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "StudyAttempt" WHERE id=${c.attemptId} FOR UPDATE`;
      const a = await tx.studyAttempt.findUniqueOrThrow({ where: { id: c.attemptId } });
      if (a.state !== 'DRAFT') throw new ApiError(409, 'Bài đã nộp.');
      if (force || !object(a.response).audioId)
        await tx.studyAttempt.update({
          where: { id: a.id },
          data: { response: { ...object(a.response), audioId: c.mediaId } as Prisma.InputJsonObject },
        });
    });
  }
  router.get('/speech-media/:id', async (req, res) => {
    const id = key.parse(req.params.id);
    verify(req.query.ticket, id, 'read');
    const clip = await db.speechClip.findUnique({ where: { id } });
    if (!clip?.mediaId) throw new ApiError(404, 'Không tìm thấy audio.');
    const file = await readAudio(db, config, clip.mediaId);
    res.type(file.mimeType).send(Buffer.from(file.data, 'base64'));
  });
  router.get(base, auth, async (req, res) => {
    const a = await attempt(req.params.id, res.locals.user.id);
    // Native submissions can already contain a primary recording from the regular study API.
    const primary = object(a.response).audioId;
    if (typeof primary === 'string') {
      const m = await db.studyMedia.findFirst({
        where: { id: primary, ownerId: a.userId },
        select: { mimeType: true },
      });
      if (m)
        await db.speechClip.createMany({
          data: [{ attemptId: a.id, mediaId: primary, mimeType: m.mimeType, source: 'MICROPHONE' }],
          skipDuplicates: true,
        });
    }
    const rows = await db.speechClip.findMany({
      where: { attemptId: a.id },
      include: clipInclude,
      orderBy: { id: 'asc' },
    });
    ok(res, rows.map(view));
  });
  router.post(base + '/upload-url', auth, mediaLimit, async (req, res) => {
    const a = await attempt(req.params.id, res.locals.user.id, true);
    const input = z
      .object({
        fileName: z.string().min(1).max(150),
        mimeType: mime,
        fileSize: z.number().int().min(0).max(4194304).nullish(),
        source: z.string().max(40).default('MICROPHONE'),
        isPrimary: z.boolean().default(false),
      })
      .parse(req.body);
    const c = await db.speechClip.create({
      data: { attemptId: a.id, mimeType: input.mimeType, source: input.source },
    });
    const token = ticket(c.id, 'upload'),
      url = '/api/speech-upload/' + c.id + '?ticket=' + token;
    ok(
      res,
      {
        id: c.id,
        recordingId: c.id,
        attemptId: a.publicId,
        bucketName: 'astralingo-media',
        storagePath: String(c.id),
        fileName: input.fileName,
        mimeType: c.mimeType,
        isPrimary: input.isPrimary,
        uploadUrl: url,
        token,
      },
      201,
    );
  });
  router.put(
    '/speech-upload/:id',
    mediaLimit,
    express.raw({ type: () => true, limit: '4mb' }),
    async (req, res) => {
      const id = key.parse(req.params.id);
      verify(req.query.ticket, id, 'upload');
      const c = await db.speechClip.findUnique({ where: { id }, include: clipInclude });
      if (!c || c.mediaId || c.attempt.state !== 'DRAFT')
        throw new ApiError(409, 'Liên kết tải lên đã dùng hoặc hết hiệu lực.');
      if (!Buffer.isBuffer(req.body)) throw new ApiError(400, 'Cần dữ liệu audio.');
      const m = await storeAudio(db, config, c.attempt.userId, c.mimeType, Buffer.from(req.body));
      const updated = await db.speechClip.updateMany({
        where: { id, mediaId: null, attempt: { state: 'DRAFT' } },
        data: { mediaId: m.id },
      });
      if (!updated.count) throw new ApiError(409, 'Bản ghi đã thay đổi.');
      ok(res, { path: String(id), id });
    },
  );
  router.post(base, auth, async (req, res) => {
    const a = await attempt(req.params.id, res.locals.user.id, true),
      d = details.parse(req.body);
    const id = z
      .string()
      .min(1)
      .max(160)
      .parse(req.body.mediaId ?? req.body.audioUrl)
      .replace(/^\/api\/(?:media\/content|study\/audio)\//, '');
    const m = await db.studyMedia.findFirst({
      where: { id, ownerId: a.userId },
      select: { id: true, mimeType: true },
    });
    if (!m) throw new ApiError(400, 'Hãy tải bản ghi vào tài khoản trước.');
    const c = await db.speechClip.upsert({
      where: { attemptId_mediaId: { attemptId: a.id, mediaId: m.id } },
      create: {
        attemptId: a.id,
        mediaId: m.id,
        mimeType: m.mimeType,
        source: d.source,
        durationSec: d.durationSec,
        waveform: d.waveformJson ?? undefined,
      },
      update: {},
      include: clipInclude,
    });
    await select(c, !!d.isPrimary);
    ok(res, view(await owned(c.id, a.userId)), 201);
  });
  router.get(
    [single, single + '/signed-url', single + '/waveform', single + '/playback-meta'],
    auth,
    async (req, res) => {
      const c = await owned(req.params.id, res.locals.user.id),
        v = view(c);
      ok(res, { ...v, recordingId: c.id, signedUrl: v.audioUrl, expiresIn: 300, storagePath: c.mediaId });
    },
  );
  router.patch(single, auth, async (req, res) => {
    const c = await owned(req.params.id, res.locals.user.id);
    await attempt(c.attempt.publicId, c.attempt.userId, true);
    const d = details.partial().parse(req.body);
    await db.speechClip.update({
      where: { id: c.id },
      data: { source: d.source, durationSec: d.durationSec, waveform: d.waveformJson ?? undefined },
    });
    if (d.isPrimary) await select(c, true);
    ok(res, view(await owned(c.id, c.attempt.userId)));
  });
  router.post(
    [single + '/upload-complete', single + '/set-primary', single + '/reprocess'],
    auth,
    async (req, res) => {
      const c = await owned(req.params.id, res.locals.user.id);
      if (!c.mediaId) throw new ApiError(409, 'Chưa tải lên audio.');
      if (req.path.endsWith('/reprocess')) {
        const file = await readAudio(db, config, c.mediaId);
        const bytes = Buffer.from(file.data, 'base64');
        if (
          file.mimeType === 'audio/wav' &&
          bytes.length >= 44 &&
          bytes.toString('ascii', 36, 40) === 'data' &&
          bytes.readUInt16LE(34) === 16
        ) {
          const samples = Math.min(Math.floor((bytes.length - 44) / 2), Math.floor(bytes.readUInt32LE(40) / 2));
          const wave = Array.from(
            { length: Math.min(128, samples) },
            (_, i) =>
              Math.abs(bytes.readInt16LE(44 + 2 * Math.floor((i * samples) / Math.min(128, samples)))) / 32768,
          );
          const rate = bytes.readUInt32LE(24) * bytes.readUInt16LE(22);
          await db.speechClip.update({
            where: { id: c.id },
            data: { waveform: wave, durationSec: rate ? samples / rate : null },
          });
        }
      } else await select(c, req.path.endsWith('/set-primary') || req.body?.isPrimary === true);
      ok(res, view(await owned(c.id, c.attempt.userId)));
    },
  );
  router.delete(single, auth, async (req, res) => {
    const c = await owned(req.params.id, res.locals.user.id);
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "StudyAttempt" WHERE id=${c.attemptId} FOR UPDATE`;
      const a = await tx.studyAttempt.findUniqueOrThrow({ where: { id: c.attemptId } });
      if (a.state !== 'DRAFT') throw new ApiError(409, 'Bài đã nộp.');
      const response = { ...object(a.response) };
      if (response.audioId === c.mediaId) {
        delete response.audioId;
        await tx.studyAttempt.update({
          where: { id: a.id },
          data: { response: response as Prisma.InputJsonObject },
        });
      }
      await tx.speechClip.delete({ where: { id: c.id } });
    });
    ok(res, { deleted: true, id: c.id, attemptId: c.attempt.publicId });
  });
  return router;
}
