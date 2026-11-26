import { Router, type RequestHandler } from 'express';
import { type PrismaClient, type PassageWord } from '@prisma/client';
import { z } from 'zod';
import { ok, ApiError } from './http.js';

const id = z.coerce.number().int().positive().max(2147483647);
const fields = z.object({
  surfaceForm: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .transform((s) => s.toLowerCase()),
  languageCode: z.literal('en').optional(),
  meaningNative: z.string().trim().max(500).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  wordId: z.string().max(180).nullable().optional(),
});
function view(row: PassageWord, passageId: number) {
  return {
    id: row.id,
    userId: row.userId,
    passageId,
    surfaceForm: row.word,
    languageCode: 'en',
    meaningNative: row.meaning,
    note: row.note,
    wordId: row.wordId,
    createdAt: row.createdAt,
    word: row.wordId ? { id: row.wordId, definition: row.meaning } : null,
  };
}
export function passageWordRoutes(db: PrismaClient, auth: RequestHandler) {
  const router = Router(),
    base = '/reading-passages/:id/saved-words',
    single = '/reading-saved-words/:id';
  async function passage(raw: unknown, userId: string) {
    const row = await db.contentItem.findFirst({
      where: {
        publicId: id.parse(raw),
        contentType: 'READING',
        course: { language: 'en' },
        OR: [{ ownerId: userId }, { status: 'PUBLISHED', OR: [{ ownerId: null }, { isPublic: true }] }],
      },
    });
    if (!row) throw new ApiError(404, 'Không tìm thấy bài đọc.');
    return row;
  }
  router.get(base + '/mine', auth, async (req, res) => {
    const userId = res.locals.user.id,
      lesson = await passage(req.params.id, userId);
    const rows = await db.passageWord.findMany({
      where: { userId, lessonId: lesson.id },
      orderBy: { id: 'desc' },
    });
    ok(
      res,
      rows.map((r) => view(r, lesson.publicId)),
    );
  });
  router.post(base, auth, async (req, res) => {
    const userId = res.locals.user.id,
      lesson = await passage(req.params.id, userId),
      input = fields.parse(req.body);
    const word = input.surfaceForm,
      lessonId = lesson.id;
    const data = { meaning: input.meaningNative, wordId: input.wordId, note: input.note };
    const [saved] = await db.$transaction([
      db.passageWord.upsert({
        where: { userId_lessonId_word: { userId, lessonId, word } },
        create: { userId, lessonId, word, ...data },
        update: data,
      }),
      db.savedWord.upsert({
        where: { userId_word: { userId, word } },
        create: { userId, word, meaning: input.meaningNative ?? '' },
        update: input.meaningNative ? { meaning: input.meaningNative } : {},
      }),
    ]);
    ok(res, view(saved, lesson.publicId), 201);
  });
  router.patch(single, auth, async (req, res) => {
    const key = id.parse(req.params.id),
      userId = res.locals.user.id;
    const prior = await db.passageWord.findFirst({ where: { id: key, userId }, include: { lesson: true } });
    if (!prior) throw new ApiError(404, 'Không tìm thấy từ đã lưu.');
    const input = fields.partial().parse(req.body),
      word = input.surfaceForm ?? prior.word;
    const [row] = await db.$transaction([
      db.passageWord.update({
        where: { id: key, userId },
        data: { word, meaning: input.meaningNative, note: input.note, wordId: input.wordId },
      }),
      db.savedWord.upsert({
        where: { userId_word: { userId, word } },
        create: { userId, word, meaning: input.meaningNative ?? prior.meaning ?? '' },
        update: { meaning: input.meaningNative ?? undefined },
      }),
    ]);
    ok(res, view(row, prior.lesson.publicId));
  });
  router.delete(single, auth, async (req, res) => {
    if (
      !(await db.passageWord.deleteMany({ where: { id: id.parse(req.params.id), userId: res.locals.user.id } }))
        .count
    )
      throw new ApiError(404, 'Không tìm thấy từ đã lưu.');
    ok(res, { deleted: true });
  });
  return router;
}
