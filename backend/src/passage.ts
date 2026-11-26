import { Router, type RequestHandler } from 'express';
import { Prisma, type Annotation, type ContentItem, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { ok, ApiError } from './http.js';

const key = z.coerce.number().int().min(1).max(2147483647);
const object = (value: Prisma.JsonValue | null): Prisma.JsonObject =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const mark = z.enum(['HIGHLIGHT', 'NOTE', 'BOOKMARK']);
const changes = z.object({
  rangeStart: z.number().int().nonnegative().optional(),
  rangeEnd: z.number().int().nonnegative().optional(),
  sentenceId: z
    .union([z.string().max(80), z.number().int()])
    .transform(String)
    .nullable()
    .optional(),
  noteText: z.string().trim().max(1000).nullable().optional(),
});
function asNote(row: Annotation, lesson: ContentItem) {
  return {
    id: row.publicId,
    userId: row.userId,
    passageId: lesson.publicId,
    audioId: lesson.publicId,
    type: row.kind,
    rangeStart: row.rangeStart,
    rangeEnd: row.rangeEnd,
    sentenceId: row.sentenceId,
    noteText: row.note,
    quote: row.quote,
    pinned: row.pinned,
    archived: row.archived,
    createdAt: row.createdAt,
  };
}
export function passageRoutes(db: PrismaClient, auth: RequestHandler) {
  const router = Router();
  for (const skill of ['reading', 'listening', 'speaking'] as const) {
    const contentType = skill === 'reading' ? 'READING' : skill === 'speaking' ? 'SPEAKING' : 'LISTENING';
    const base =
      '/' +
      { reading: 'reading-passages', listening: 'listening-audios', speaking: 'speaking-prompts' }[skill] +
      '/:id';
    const entity = '/' + skill + '-annotations/:id';
    const visible = (userId: string): Prisma.ContentItemWhereInput => ({
      contentType,
      course: { language: 'en' },
      OR: [{ ownerId: userId }, { status: 'PUBLISHED', OR: [{ ownerId: null }, { isPublic: true }] }],
    });
    async function getLesson(id: unknown, userId: string) {
      const row = await db.contentItem.findFirst({ where: { publicId: key.parse(id), ...visible(userId) } });
      if (!row) throw new ApiError(404, 'Không tìm thấy nội dung.');
      return row;
    }
    async function getMark(id: unknown, userId: string) {
      const row = await db.annotation.findFirst({
        where: { publicId: key.parse(id), userId, lesson: { contentType } },
        include: { lesson: true },
      });
      if (!row) throw new ApiError(404, 'Không tìm thấy ghi chú.');
      return row;
    }
    function detail(row: ContentItem) {
      const data = object(row.practice),
        fields = object(row.detail);
      const transcriptJson = {
        segments: (Array.isArray(data.transcript) ? data.transcript : []).map((t) => {
          const obj = object(t);
          return { startSec: obj.second, text: obj.text };
        }),
      };
      return {
        ...fields,
        id: row.publicId,
        contentItemId: row.publicId,
        transcript: data.body,
        promptText: data.body,
        transcriptJson,
        contentItem: {
          id: row.publicId,
          title: row.title,
          authorId: row.ownerId,
          status: row.status,
          isPublic: row.isPublic || row.ownerId === null,
          description: row.preview,
        },
      };
    }
    router.get(
      [
        base + '/detail',
        base + '/preview',
        base + '/player-data',
        base + '/transcript',
        base + '/transcript/timed',
        base + '/sample-answer',
        base + '/expected-points',
      ],
      auth,
      async (req, res) => ok(res, detail(await getLesson(req.params.id, res.locals.user.id))),
    );
    router.get(base + '/access-check', auth, async (req, res) => {
      const item = await getLesson(req.params.id, res.locals.user.id);
      ok(res, {
        audioId: item.publicId,
        promptId: item.publicId,
        contentItemId: item.publicId,
        canAccess: true,
        isOwner: item.ownerId === res.locals.user.id,
        isPublic: item.ownerId === null || item.isPublic,
        status: item.status,
        reason: null,
      });
    });
    router.get([base + '/related', base + '/recommended'], auth, async (req, res) => {
      const userId = res.locals.user.id,
        row = await getLesson(req.params.id, userId);
      const rows = await db.contentItem.findMany({
        where: { ...visible(userId), id: { not: row.id } },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
        take: key.max(30).default(5).parse(req.query.limit),
      });
      ok(res, { items: rows.map(detail), basePrompt: detail(row) });
    });
    router.get(
      [
        base + '/my-progress-summary',
        base + '/stats',
        base + '/my-best-attempt',
        base + '/my-latest-attempt',
        base + '/has-unfinished-attempt',
        base + '/can-review-check',
      ],
      auth,
      async (req, res) => {
        const userId = res.locals.user.id,
          row = await getLesson(req.params.id, userId);
        const where = { userId, lessonId: row.id };
        const [latest, best, total, grades, draft] = await db.$transaction([
          db.studyAttempt.findFirst({ where, orderBy: { updatedAt: 'desc' } }),
          db.studyAttempt.findFirst({ where: { ...where, score: { not: null } }, orderBy: { score: 'desc' } }),
          db.studyAttempt.count({ where }),
          db.studyAttempt.aggregate({
            where: { ...where, state: { in: ['COMPLETED', 'SUBMITTED'] } },
            _count: true,
            _avg: { score: true },
          }),
          db.studyAttempt.findFirst({ where: { ...where, state: 'DRAFT' }, orderBy: { updatedAt: 'desc' } }),
        ]);
        const ref = { audioId: row.publicId, promptId: row.publicId, contentItemId: row.publicId };
        const attempt = (a: typeof latest) =>
          a
            ? {
                id: a.publicId,
                status: a.state,
                score: a.score,
                startedAt: a.createdAt,
                finishedAt: a.completedAt ?? a.submittedAt,
              }
            : null;
        if (req.path.endsWith('my-best-attempt')) return ok(res, { ...ref, attempt: attempt(best) });
        if (req.path.endsWith('my-latest-attempt')) return ok(res, { ...ref, attempt: attempt(latest) });
        if (req.path.endsWith('has-unfinished-attempt'))
          return ok(res, { ...ref, hasUnfinishedAttempt: !!draft, attempt: attempt(draft) });
        if (req.path.endsWith('can-review-check')) return ok(res, { ...ref, canReview: grades._count > 0 });
        ok(res, {
          ...ref,
          totalAttempts: total,
          totalCompletedAttempts: grades._count,
          averageScore: grades._avg.score,
          bestScore: best?.score ?? null,
        });
      },
    );
    router.get(
      [
        base + '/can-submit-check',
        base + '/transcript-visibility',
        base + '/replay-policy',
        base + '/my-learning-state',
        base + '/my-annotations-summary',
        base + '/practice-config',
      ],
      auth,
      async (req, res) => {
        const userId = res.locals.user.id,
          item = await getLesson(req.params.id, userId),
          data = object(item.practice);
        const [marks, completed, draft] = await db.$transaction([
          db.annotation.groupBy({
            by: ['kind'],
            orderBy: { kind: 'asc' },
            where: { userId, lessonId: item.id, archived: false },
            _count: true,
          }),
          db.studyAttempt.count({
            where: { userId, lessonId: item.id, state: { in: ['COMPLETED', 'SUBMITTED'] } },
          }),
          db.studyAttempt.findFirst({
            where: { userId, lessonId: item.id, state: 'DRAFT' },
            orderBy: { updatedAt: 'desc' },
          }),
        ]);
        ok(res, {
          audioId: item.publicId,
          promptId: item.publicId,
          contentItemId: item.publicId,
          canSubmit: item.status === 'PUBLISHED',
          canReplay: true,
          maxReplays: null,
          transcriptVisible: typeof data.body === 'string',
          transcriptAvailable: typeof data.body === 'string',
          completedAttempts: completed,
          currentAttempt: draft ? { id: draft.publicId, status: draft.state } : null,
          notes: marks.find((m) => m.kind === 'NOTE')?._count ?? 0,
          bookmarks: marks.find((m) => m.kind === 'BOOKMARK')?._count ?? 0,
          highlights: marks.find((m) => m.kind === 'HIGHLIGHT')?._count ?? 0,
          allowTranscriptInput: true,
          speakingTimeSec: 90,
          ...object(item.detail),
        });
      },
    );
    if (skill === 'speaking') continue;
    router.get(
      [
        base + '/annotations',
        base + '/annotations/mine',
        base + '/bookmarks/mine',
        base + '/notes/mine',
        base + '/highlights/mine',
      ],
      auth,
      async (req, res) => {
        const userId = res.locals.user.id,
          item = await getLesson(req.params.id, userId);
        const filter = req.path.includes('/bookmarks/')
          ? 'BOOKMARK'
          : req.path.includes('/highlights/')
            ? 'HIGHLIGHT'
            : req.path.includes('/notes/')
              ? 'NOTE'
              : undefined;
        const rows = await db.annotation.findMany({
          where: { lessonId: item.id, userId, kind: filter, archived: false },
          orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
        });
        ok(
          res,
          rows.map((row) => asNote(row, item)),
        );
      },
    );
    function positions(input: z.infer<typeof changes>, item: ContentItem, prior?: Annotation) {
      const body = String(object(item.practice).body ?? '');
      const rangeStart = input.rangeStart ?? prior?.rangeStart,
        rangeEnd = input.rangeEnd ?? prior?.rangeEnd;
      if (
        (rangeStart == null) !== (rangeEnd == null) ||
        (rangeStart != null &&
          rangeEnd != null &&
          (rangeEnd <= rangeStart || rangeEnd > body.length || rangeEnd - rangeStart > 500))
      )
        throw new ApiError(400, 'Khoảng đánh dấu không nằm trong nội dung.');
      return {
        rangeStart,
        rangeEnd,
        quote: rangeStart != null && rangeEnd != null ? body.slice(rangeStart, rangeEnd) : (prior?.quote ?? ''),
        sentenceId: input.sentenceId,
        note: input.noteText ?? prior?.note ?? '',
      };
    }
    router.post(base + '/annotations', auth, async (req, res) => {
      const userId = res.locals.user.id,
        item = await getLesson(req.params.id, userId);
      const input = changes.extend({ type: mark }).parse(req.body);
      const row = await db.annotation.create({
        data: { userId, lessonId: item.id, kind: input.type, ...positions(input, item) },
      });
      ok(res, asNote(row, item), 201);
    });
    router.get(entity, auth, async (req, res) => {
      const row = await getMark(req.params.id, res.locals.user.id);
      ok(res, asNote(row, row.lesson));
    });
    const edit: RequestHandler = async (req, res) => {
      const row = await getMark(req.params.id, res.locals.user.id);
      const data = req.path.endsWith('/pin')
        ? { pinned: true }
        : req.path.endsWith('/unpin')
          ? { pinned: false }
          : req.path.endsWith('/archive')
            ? { archived: true }
            : positions(changes.parse(req.body), row.lesson, row);
      ok(
        res,
        asNote(
          await db.annotation.update({ where: { id: row.id, userId: res.locals.user.id }, data }),
          row.lesson,
        ),
      );
    };
    router.patch([entity, entity + '/pin', entity + '/unpin', entity + '/archive'], auth, edit);
    router.post([entity + '/pin', entity + '/unpin', entity + '/archive'], auth, edit);
    router.delete(entity, auth, async (req, res) => {
      const row = await getMark(req.params.id, res.locals.user.id);
      await db.annotation.delete({ where: { id: row.id, userId: row.userId } });
      ok(res, { deleted: true });
    });
  }
  return router;
}
