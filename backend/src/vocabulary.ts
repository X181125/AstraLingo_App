import { searchWords } from "./dictionary.js";
import { Router, type RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { ApiError, ok } from './http.js';
import { flashcard, generate } from './learning-services.js';
import { recordStudy } from './study.js';
import type { Config } from './config.js';

const id = z.string().min(1).max(128);
const deckTitle = z.string().trim().min(2).max(100);
const text = z.string().trim().min(1).max(10_000);
const rating = z.enum(['again', 'hard', 'good', 'easy']);
const dayMs = 86_400_000;

export function schedule(previousBox: number, answer: z.infer<typeof rating>, now: Date) {
  const box = answer === 'again' ? 1 : answer === 'hard' ? previousBox : Math.min(10, previousBox + (answer === 'easy' ? 2 : 1));
  const days = ({ again: 0, hard: 1, good: box * 2, easy: box * 4 })[answer];
  return { box, nextReview: new Date(now.valueOf() + days * dayMs), reviewedAt: now };
}

export async function reviewCard(db: PrismaClient, userId: string, cardId: string, answer: z.infer<typeof rating>) {
  const now = new Date();
  return db.$transaction(async tx => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT c.id FROM "Card" c JOIN "Deck" d ON c."deckId" = d.id WHERE c.id = ${cardId} AND d."ownerId" = ${userId}
      FOR UPDATE OF c
    `;
    if (!locked.length) throw new ApiError(404, 'Sao chép bộ thẻ về tài khoản trước khi ôn.');
    const where = { userId_cardId: { userId, cardId } };
    const previous = await tx.cardReview.findUnique({ where });
    if (previous && previous.nextReview > now) throw new ApiError(409, 'Thẻ này chưa đến lịch ôn.');
    const data = schedule(previous?.box ?? 1, answer, now);
    const review = await tx.cardReview.upsert({ where, create: { userId, cardId, ...data }, update: data });
    await recordStudy(tx, userId);
    return review;
  });
}

export function vocabularyRouter(db: PrismaClient, config: Config, auth: RequestHandler) {
  const router = Router();
  router.use(auth);
  async function ownDeck(deckId: string, userId: string) {
    const deck = await db.deck.findFirst({ where: { id: deckId, ownerId: userId } });
    if (!deck) throw new ApiError(404, 'Không tìm thấy bộ thẻ của bạn.');
    return deck;
  }
  router.get('/dictionary', async (req, res) => {
    const { q, page } = z.object({ q: z.string().trim().toLowerCase().max(100).default(''),
      page: z.coerce.number().int().min(1).max(200000).optional() }).parse(req.query);
    const { result, total } = searchWords(q, page ?? 1);
    ok(res, page === undefined ? result : { items: result, total, hasMore: page * 24 < total });
  });
  router.get('/ai/capabilities', (_req, res) => ok(res, { gemini: Boolean(config.GEMINI_API_KEY) }));
  router.post('/ai', async (req, res) => {
    const input = z.discriminatedUnion('task', [
      z.object({ task: z.enum(['explain', 'outline', 'flashcards', 'questions', 'listening-guide', 'writing-revision']), text }),
      z.object({ task: z.literal('image-vocabulary'), mimeType: z.literal('image/jpeg'), data: z.base64().min(16).max(4_194_304) }),
    ]).parse(req.body);
    if (input.task === 'image-vocabulary') {
      const bytes = Buffer.from(input.data, 'base64');
      if (bytes.subarray(0, 3).toString('hex') !== 'ffd8ff') throw new ApiError(400, 'Ảnh JPEG không hợp lệ.');
      return ok(res, await generate(config, input.task, 'Extract useful vocabulary from this image.', { mimeType: input.mimeType, data: input.data }));
    }
    return ok(res, await generate(config, input.task, input.text));
  });
  router.get('/decks', async (req, res) => {
    const userId = res.locals.user.id as string;
    const { view, q, page } = z.object({ view: z.enum(['mine', 'explore']).default('mine'), q: z.string().trim().max(100).default(''),
      page: z.coerce.number().int().min(1).max(1000).default(1) }).parse(req.query);
    const items = await db.deck.findMany({
      where: { ...(view === 'mine' ? { ownerId: userId } : { isPublic: true }), ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}) },
      include: { _count: { select: { cards: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * 24, take: 25,
    });
    ok(res, { items: items.slice(0, 24), hasMore: items.length > 24 });
  });
  router.post('/decks', async (req, res) => {
    const input = z.object({ title: deckTitle, isPublic: z.boolean().default(false) }).parse(req.body);
    ok(res, await db.deck.create({ data: { ...input, ownerId: res.locals.user.id } }), 201);
  });
  router.get('/decks/:id', async (req, res) => {
    const userId = res.locals.user.id as string;
    const deck = await db.deck.findFirst({ where: { id: id.parse(req.params.id), OR: [{ ownerId: userId }, { isPublic: true }] },
      include: { cards: { orderBy: { id: 'asc' }, include: { reviews: { where: { userId } } } } } });
    if (!deck) throw new ApiError(404, 'Không tìm thấy bộ thẻ.');
    ok(res, deck);
  });
  router.patch('/decks/:id', async (req, res) => {
    const ownerId = res.locals.user.id as string;
    const input = z.object({ title: deckTitle.optional(), isPublic: z.boolean().optional() }).parse(req.body);
    const deck = await ownDeck(id.parse(req.params.id), ownerId);
    ok(res, await db.deck.update({ where: { id: deck.id, ownerId }, data: input }));
  });
  router.delete('/decks/:id', async (req, res) => {
    const result = await db.deck.deleteMany({ where: { id: id.parse(req.params.id), ownerId: res.locals.user.id } });
    if (!result.count) throw new ApiError(404, 'Không tìm thấy bộ thẻ của bạn.');
    ok(res, { deleted: true });
  });
  router.post('/decks/:id/clone', async (req, res) => {
    const ownerId = res.locals.user.id as string;
    const deck = await db.deck.findFirst({ where: { id: id.parse(req.params.id), OR: [{ ownerId }, { isPublic: true }] },
      include: { cards: { select: { front: true, back: true } } } });
    if (!deck) throw new ApiError(404, 'Không tìm thấy bộ thẻ.');
    ok(res, await db.deck.create({
      data: { ownerId, title: `Bản sao · ${deck.title}`.slice(0, 100), cards: { create: deck.cards } },
    }), 201);
  });
  router.post('/decks/:id/cards', async (req, res) => {
    const ownerId = res.locals.user.id as string;
    const deckId = id.parse(req.params.id);
    const { cards } = z.object({ cards: z.array(flashcard).min(1).max(40) }).parse(req.body);
    const created = await db.$transaction(async tx => {
      // Serialize batches for the same deck so concurrent writes respect the cap.
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Deck" WHERE id = ${deckId} AND "ownerId" = ${ownerId} FOR UPDATE`;
      if (!locked.length) throw new ApiError(404, 'Không tìm thấy bộ thẻ của bạn.');
      if (await tx.card.count({ where: { deckId } }) + cards.length > 300) throw new ApiError(400, 'Một bộ thẻ chứa tối đa 300 thẻ.');
      return tx.card.createMany({ data: cards.map(card => ({ ...card, deckId })) });
    });
    ok(res, created, 201);
  });
  router.put('/cards/:id', async (req, res) => {
    const data = flashcard.parse(req.body);
    const result = await db.card.updateMany({ where: { id: id.parse(req.params.id), deck: { ownerId: res.locals.user.id } }, data });
    if (!result.count) throw new ApiError(404, 'Không tìm thấy thẻ của bạn.');
    ok(res, { updated: true });
  });
  router.delete('/cards/:id', async (req, res) => {
    const result = await db.card.deleteMany({ where: { id: id.parse(req.params.id), deck: { ownerId: res.locals.user.id } } });
    if (!result.count) throw new ApiError(404, 'Không tìm thấy thẻ của bạn.');
    ok(res, { deleted: true });
  });
  router.post('/cards/:id/review', async (req, res) => {
    const userId = res.locals.user.id as string;
    const cardId = id.parse(req.params.id);
    const { answer } = z.object({ answer: rating }).parse(req.body);
    const result = await reviewCard(db, userId, cardId, answer);
    ok(res, result);
  });
  return router;
}
