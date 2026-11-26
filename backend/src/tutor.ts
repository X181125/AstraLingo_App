import { Router, type RequestHandler } from 'express';
import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { Config } from './config.js';
import { ok, ApiError } from './http.js';
import { generate } from './learning-services.js';

const key = z.coerce.number().int().positive().max(2147483647);
const term = z.string().trim().min(1).max(1500);
const object = (v: Prisma.JsonValue | null): Prisma.JsonObject =>
  v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const writingTasks: Record<string, string> = {
  brainstorm: 'Suggest three different approaches to the assignment.',
  outline: 'Make a structured outline with a thesis, reasons and evidence.',
  analyze: 'Identify the audience, required text type and task requirements.',
  'vocab-pack': 'Prepare vocabulary with collocations and examples.',
  translate: 'Translate the prompt into Vietnamese.',
  simplify: 'Rewrite the prompt in simpler English without changing its requirements.',
  thesis: 'Suggest alternative thesis statements.',
  'topic-sentences': 'Suggest topic sentences for the main paragraphs.',
  examples: 'Give concrete examples the learner could discuss.',
  'phrase-bank': 'Group useful English expressions by rhetorical function.',
  checklist: 'Make a short checklist specific to this assignment.',
};
const revision: Record<string, string> = {
  'grammar-check': 'Explain grammar errors with corrections.',
  'spell-check': 'Check spelling and show each correction in context.',
  'coherence-check': 'Explain links between paragraphs and suggest transitions.',
  improve: 'Revise the draft, then explain the changes.',
  'lexical-upgrade': 'Suggest precise alternatives for words used in the draft.',
  'task-response-check': 'Compare the draft with the requirements and identify missing points.',
  'sentence-rewrite': 'Rewrite the selected sentence and explain two alternatives.',
  'paragraph-feedback': 'Review the selected paragraph.',
  'change-tone': 'Adapt the draft to the requested tone.',
  expand: 'Expand one argument with supporting evidence.',
  shorten: 'Condense the draft while retaining its main points.',
  'coach-chat': 'Answer the learning question using the draft and assignment.',
};
const listening: Record<string, string> = {
  'transcript/clean': 'Clean punctuation and line breaks without changing the meaning.',
  'transcript/summarize': 'Summarize this transcript.',
  'transcript/translate': 'Translate the transcript into Vietnamese.',
  'transcript/explain': 'Explain what the speakers mean.',
  'transcript/simplify': 'Retell the transcript in easier English.',
  'transcript/keywords-extract': 'Extract the main keywords.',
  'transcript/vocabulary-extract': 'Explain the main vocabulary with Vietnamese meanings.',
  'transcript/chunk-explain': 'Explain the selected phrase in context.',
  'pre-listening/generate': 'Give two warm-up questions.',
  'post-listening/generate': 'Give a listening comprehension follow-up with explanations.',
  'discussion-questions/generate': 'Create discussion questions grounded in the transcript.',
  'shadowing-script/generate': 'Split the original speech into short shadowing lines.',
  'pronunciation-focus/generate': 'Identify stress, rhythm and linked sounds to practise.',
};

export function tutorRoutes(db: PrismaClient, config: Config, auth: RequestHandler, limit: RequestHandler) {
  const router = Router();
  router.use('/ai', auth, limit);
  router.post(['/ai/explain', '/ai/translate', '/ai/explain-sentence'], async (req, res) => {
    const value = term.parse(req.body?.word ?? req.body?.sentence ?? req.body?.text);
    if (req.path.endsWith('/explain-sentence')) return ok(res, await generate(config, 'explain', value));
    const word = await generate(config, 'lexicon', value);
    ok(
      res,
      req.path.endsWith('/translate') ? { original: value, translated: word.translation, nativeLang: 'vi' } : word,
    );
  });
  router.post('/ai/visual-vocabulary', async (req, res) => {
    const img = z
      .string()
      .max(4200000)
      .parse(req.body?.image)
      .replace(/^data:image\/jpeg;base64,/, '');
    if (
      !z.base64().safeParse(img).success ||
      Buffer.from(img, 'base64').subarray(0, 3).toString('hex') !== 'ffd8ff'
    )
      throw new ApiError(400, 'Cần ảnh JPEG hợp lệ.');
    const result = await generate(config, 'image-vocabulary', 'Identify English vocabulary in this photo.', {
      mimeType: 'image/jpeg',
      data: img,
    });
    ok(res, { items: result.words.map((w) => ({ word: w.front, definition: w.back, languageCode: 'en' })) });
  });
  router.post('/ai/generate-flashcards', async (req, res) => {
    const input = z
      .object({
        text: term.optional(),
        topic: term.optional(),
        count: key.max(12).default(8),
        saveToDeck: z.boolean().default(false),
        deckId: key.optional(),
        deckTitle: z.string().trim().min(2).max(100).optional(),
        deckDescription: z.string().max(500).optional(),
        deckIsPublic: z.boolean().default(false),
        dedupeInDeck: z.boolean().default(true),
      })
      .parse(req.body);
    const userId = res.locals.user.id,
      source = input.text ?? input.topic;
    if (!source) throw new ApiError(400, 'Hãy thêm văn bản hoặc chủ đề.');
    const sourceDeck = input.deckId
      ? await db.deck.findFirst({ where: { publicId: input.deckId, ownerId: userId } })
      : null;
    if (input.deckId && !sourceDeck) throw new ApiError(404, 'Không tìm thấy bộ thẻ.');
    const cards = (await generate(config, 'flashcards', `Generate ${input.count} cards.\n${source}`)).cards.slice(
      0,
      input.count,
    );
    const items = cards.map((c) => ({ word: c.front, translation: c.back, definition: c.back }));
    if (!input.saveToDeck) return ok(res, { deckId: null, created: 0, skipped: 0, skippedReasons: [], items });
    const saved = await db.$transaction(async (tx) => {
      const deck =
        sourceDeck ??
        (await tx.deck.create({
          data: {
            ownerId: userId,
            title: input.deckTitle ?? source.slice(0, 80),
            description: input.deckDescription,
            isPublic: input.deckIsPublic,
          },
        }));
      const locked = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "Deck" WHERE id=${deck.id} AND "ownerId"=${userId} FOR UPDATE`;
      if (!locked.length) throw new ApiError(404, 'Không tìm thấy bộ thẻ.');
      const existing = await tx.card.findMany({ where: { deckId: deck.id }, select: { front: true } });
      const seen = new Set(existing.map((c) => c.front.toLowerCase())),
        skippedReasons: { word: string; reason: string }[] = [];
      const batch = cards.filter((c) => {
        if (input.dedupeInDeck && seen.has(c.front.toLowerCase())) {
          skippedReasons.push({ word: c.front, reason: 'Đã có trong bộ thẻ' });
          return false;
        }
        seen.add(c.front.toLowerCase());
        return true;
      });
      if (existing.length + batch.length > 300) throw new ApiError(400, 'Bộ thẻ chứa tối đa 300 thẻ.');
      if (batch.length) await tx.card.createMany({ data: batch.map((c) => ({ ...c, deckId: deck.id })) });
      return {
        deckId: deck.publicId,
        created: batch.length,
        skipped: skippedReasons.length,
        skippedReasons,
        items,
      };
    });
    ok(res, saved);
  });
  for (const [skill, tasks] of [
    ['WRITING', writingTasks],
    ['LISTENING', listening],
  ] as const) {
    const prefix = skill === 'WRITING' ? '/writing-prompts/:id/ai/' : '/listening-audios/:id/';
    for (const [name, instruction] of Object.entries(tasks)) {
      router.post(prefix + name, auth, limit, async (req, res) => {
        const row = await db.contentItem.findFirst({
          where: {
            publicId: key.parse(req.params.id),
            contentType: skill,
            course: { language: 'en' },
            OR: [
              { ownerId: res.locals.user.id },
              { status: 'PUBLISHED', OR: [{ isPublic: true }, { ownerId: null }] },
            ],
          },
        });
        if (!row) throw new ApiError(404, 'Không tìm thấy nội dung.');
        ok(
          res,
          await generate(
            config,
            'tutor',
            JSON.stringify({
              activity: instruction,
              passage: object(row.practice).body ?? row.preview,
              learnerOptions: req.body,
            }),
          ),
        );
      });
    }
  }
  for (const [name, instruction] of Object.entries({
    ...revision,
    'generate-practice': 'Generate a quiz using the learner’s draft.',
    'create-flashcards': 'Generate vocabulary cards for this draft.',
  })) {
    router.post('/writing-submissions/:id/ai/' + name, auth, limit, async (req, res) => {
      const row = await db.studyAttempt.findFirst({
        where: { publicId: key.parse(req.params.id), mode: 'WRITING', userId: res.locals.user.id },
        include: { lesson: true },
      });
      if (!row) throw new ApiError(404, 'Không tìm thấy bài viết của bạn.');
      const text = object(row.response).text;
      if (!text) throw new ApiError(400, 'Nhập bài viết trước khi yêu cầu góp ý.');
      const task =
        name === 'generate-practice' ? 'questions' : name === 'create-flashcards' ? 'flashcards' : 'tutor';
      ok(
        res,
        await generate(
          config,
          task,
          JSON.stringify({
            activity: instruction,
            assignment: row.lesson.preview,
            draft: text,
            learnerOptions: req.body,
          }),
        ),
      );
    });
  }
  return router;
}
