import { Router, type RequestHandler } from 'express';
import { ContentStatus, ContentType, Prisma, type PrismaClient, type User } from '@prisma/client';
import { z } from 'zod';
import { ApiError, ok } from './http.js';

const codes = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
const names = ['Beginner', 'Elementary', 'Intermediate', 'Upper intermediate', 'Advanced', 'Proficient'];
const levels = codes.map((code, i) => ({ id: i + 1, code, name: names[i] }));
const numeric = z.coerce.number().int().min(1).max(2147483647);
const levelId = numeric.max(levels.length);
const flag = z.stringbool().optional();
const brief = z.string().trim().max(10000);
const detailFields = z.object({
  plainText: brief.optional(),
  transcript: brief.optional(),
  promptText: brief.optional(),
  audioUrl: z.union([z.url({protocol:/^https$/}),z.string().regex(/^\/api\/media\/content\/[a-zA-Z0-9-]{1,128}$/)]).optional(),
  wordCount: z.number().int().nonnegative().optional(),
  sampleAnswer: brief.optional(),
  accent: brief.optional(),
  speedLevel: brief.optional(),
  durationSec: z.number().nonnegative().optional(),
  expectedPointsJson: z.json().optional(),
  constraintsJson: z.json().optional(),
  structuredJson: z.json().optional(),
  transcriptJson: z.json().optional(),
});
const editable = z.object({
  title: z.string().trim().min(2).max(120),
  description: brief.nullable().optional(),
  categoryId: numeric,
  levelId,
  estimatedCefr: z.enum(codes).nullable().optional(),
  difficultyScore: z.number().finite().nullable().optional(),
  sourceLang: z.enum(['en', 'vi']).optional(),
  targetLang: z.literal('en').optional(),
  detail: detailFields,
  status: z.enum(ContentStatus).optional(),
  isPublic: z.boolean().optional(),
});
const create = editable.extend({ contentType: z.enum(ContentType) });
const include = { course: { include: { category: true } } } as const;
type Item = Prisma.ContentItemGetPayload<{ include: typeof include }>;
const categoryView = (row: { publicId: number; name: string }) => ({
  id: row.publicId,
  type: 'TOPIC',
  title: row.name,
});
const object = (value: Prisma.JsonValue | null): Prisma.JsonObject =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};
function view(item: Item, detailed: boolean) {
  const practice = object(item.practice);
  const body = typeof practice.body === 'string' ? practice.body : item.preview;
  const level = levels.find((x) => x.code === (item.levelCode ?? item.course.level));
  const category = categoryView(item.course.category);
  const fields = { id: item.publicId, contentItemId: item.publicId, ...object(item.detail) };
  return {
    id: item.publicId,
    lessonId: item.id,
    title: item.title,
    description: item.description ?? item.preview,
    contentType: item.contentType,
    status: item.status,
    isPublic: item.status === 'PUBLISHED' && (item.isPublic || !item.ownerId),
    category,
    categoryId: category.id,
    level,
    levelId: level?.id,
    authorId: item.ownerId,
    sourceLang: 'vi',
    targetLang: 'en',
    estimatedCefr: item.estimatedCefr ?? level?.code,
    difficultyScore: item.difficultyScore,
    ...(detailed && {
      readingPassage:
        item.contentType === 'READING'
          ? { ...fields, plainText: body, wordCount: body.trim().split(/\s+/).length }
          : null,
      listeningAudio:
        item.contentType === 'LISTENING'
          ? { ...fields, transcript: body, transcriptJson: practice.transcript ?? [] }
          : null,
      writingPrompt: item.contentType === 'WRITING' ? { ...fields, promptText: body } : null,
      speakingPrompt: item.contentType === 'SPEAKING' ? { ...fields, promptText: body } : null,
    }),
  };
}

export function catalogRoutes(db: PrismaClient, auth: RequestHandler) {
  const router = Router();
  router.get('/user-levels', (_req, res) => ok(res, levels));
  function userView(user: User) {
    const { id, email, nativeLang, targetLang, avatarUrl, createdAt, name } = user;
    return {
      id,
      email,
      fullName: name,
      nativeLang,
      targetLang,
      avatarUrl,
      createdAt,
      level: levels.find((x) => x.code === user.level),
    };
  }
  router.get('/users/me', auth, (_req, res) => ok(res, userView(res.locals.user)));
  router.put('/users/me', auth, async (req, res) => {
    const {
      fullName,
      levelId: selected,
      ...data
    } = z
      .object({
        fullName: z.string().trim().min(2).max(60).optional(),
        nativeLang: z.enum(['vi', 'en', 'other']).optional(),
        targetLang: z.literal('en').optional(),
        avatarUrl: z
          .url({ protocol: /^https$/ })
          .max(2000)
          .nullable()
          .optional(),
        levelId: levelId.nullable().optional(),
      })
      .parse(req.body);
    const user = await db.user.update({
      where: { id: res.locals.user.id },
      data: { ...data, name: fullName, level: selected ? levels[selected - 1].code : undefined },
    });
    ok(res, userView(user));
  });
  router.get('/content-categories', async (req, res) => {
    const rows = await db.category.findMany({
      where: { courses: { some: { language: 'en' } } },
      orderBy: { order: 'asc' },
    });
    ok(res, req.query.type && req.query.type !== 'TOPIC' ? [] : rows.map(categoryView));
  });
  router.get('/content-categories/:id', async (req, res) => {
    const row = await db.category.findFirst({
      where: { publicId: numeric.parse(req.params.id), courses: { some: { language: 'en' } } },
    });
    if (!row) throw new ApiError(404, 'Không tìm thấy danh mục.');
    ok(res, categoryView(row));
  });
  const published: Prisma.ContentItemWhereInput = {
    status: 'PUBLISHED',
    OR: [{ ownerId: null }, { isPublic: true }],
  };
  const visible = (userId: string): Prisma.ContentItemWhereInput => ({ OR: [published, { ownerId: userId }] });
  const list: RequestHandler = async (req, res) => {
    const q = z
      .object({
        contentType: z.enum(ContentType).optional(),
        status: z.enum(ContentStatus).optional(),
        categoryId: numeric.optional(),
        levelId: levelId.optional(),
        q: z.string().max(120).optional(),
        isPublic: flag,
        includeDetail: flag,
        page: numeric.max(100000).default(1),
        limit: numeric.max(100).default(20),
      })
      .parse(req.query);
    const scope = req.path.endsWith('/mine')
      ? { ownerId: res.locals.user.id }
      : req.path.endsWith('/explore')
        ? published
        : visible(res.locals.user.id);
    const code = q.levelId ? levels[q.levelId - 1].code : undefined;
    const where: Prisma.ContentItemWhereInput = {
      AND: [
        scope,
        ...(code ? [{ OR: [{ levelCode: code }, { levelCode: null, course: { level: code } }] }] : []),
        ...(q.isPublic === undefined
          ? []
          : [q.isPublic ? published : { isPublic: false, ownerId: { not: null } }]),
      ],
      practice: { not: Prisma.DbNull },
      course: { language: 'en', category: { publicId: q.categoryId } },
      contentType: q.contentType,
      status: q.status,
      title: q.q ? { contains: q.q, mode: 'insensitive' } : undefined,
    };
    const [rows, total] = await db.$transaction([
      db.contentItem.findMany({
        where,
        include,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: { publicId: 'asc' },
      }),
      db.contentItem.count({ where }),
    ]);
    ok(res, {
      items: rows.map((item) => view(item, Boolean(q.includeDetail))),
      total,
      page: q.page,
      limit: q.limit,
      totalPages: Math.ceil(total / q.limit),
    });
  };
  router.get('/content-items/explore', list);
  router.get(['/content-items', '/content-items/mine'], auth, list);
  async function get(raw: unknown, userId: string, own = false) {
    const row = await db.contentItem.findFirst({
      where: {
        publicId: numeric.parse(raw),
        course: { language: 'en' },
        ...(own ? { ownerId: userId } : visible(userId)),
      },
      include,
    });
    if (!row) throw new ApiError(404, 'Không tìm thấy bài học.');
    return row;
  }
  router.get('/content-items/:id', auth, async (req, res) =>
    ok(res, view(await get(req.params.id, res.locals.user.id), req.query.includeDetail !== 'false')),
  );
  async function fields(input: Partial<z.infer<typeof editable>>, type: ContentType, ownerId: string, previous?: Item) {
    const detail = { ...object(previous?.detail ?? null), ...input.detail };
    const practice = object(previous?.practice ?? null);
    const source =
      type === 'READING' ? detail.plainText : type === 'LISTENING' ? detail.transcript : detail.promptText;
    const body = typeof source === 'string' ? source : practice.body;
    if (typeof body !== 'string' || !body.trim())
      throw new ApiError(400, 'Hãy nhập nội dung hoặc transcript cho bài học.');
    let courseId = previous?.courseId;
    if (input.categoryId !== undefined) {
      const course = await db.course.findFirst({
        where: { language: 'en', category: { publicId: input.categoryId } },
        orderBy: { id: 'asc' },
      });
      if (!course) throw new ApiError(400, 'Danh mục chưa có khóa học tiếng Anh.');
      courseId = course.id;
    }
    const uploaded = typeof detail.audioUrl === 'string' && detail.audioUrl.startsWith('/api/media/content/') ? detail.audioUrl.split('/').at(-1) : undefined;
    if (uploaded && !await db.studyMedia.count({where:{id:uploaded,ownerId}})) throw new ApiError(400,'Bản ghi không thuộc tài khoản của bạn.');
    const status = input.status ?? previous?.status ?? 'DRAFT';
    return {
      courseId: courseId!,
      title: input.title ?? previous!.title,
      contentType: type,
      description: input.description,
      estimatedCefr: input.estimatedCefr,
      difficultyScore: input.difficultyScore,
      levelCode: input.levelId ? levels[input.levelId - 1].code : undefined,
      status,
      isPublic: status === 'PUBLISHED' && (input.isPublic ?? previous?.isPublic ?? false),
      preview: body.slice(0, 240),
      detail: detail as Prisma.InputJsonObject,
      practice: {
        ...practice,
        ...(uploaded && {audioId:uploaded}),
        body,
        questions: practice.questions ?? [],
        transcript: practice.transcript ?? [],
      } as Prisma.InputJsonObject,
    };
  }
  router.post('/content-items', auth, async (req, res) => {
    const input = create.parse(req.body);
    const data = await fields(input, input.contentType,res.locals.user.id);
    const row = await db.contentItem.create({
      data: { ...data, id: crypto.randomUUID(), ownerId: res.locals.user.id, order: 100, minutes: 10 },
      include,
    });
    ok(res, view(row, true), 201);
  });
  router.put('/content-items/:id', auth, async (req, res) => {
    const row = await get(req.params.id, res.locals.user.id, true);
    const data = await fields(editable.partial().parse(req.body), row.contentType,res.locals.user.id,row);
    ok(
      res,
      view(
        await db.contentItem.update({ where: { id: row.id, ownerId: res.locals.user.id }, data, include }),
        true,
      ),
    );
  });
  const setStatus: RequestHandler = async (req, res) => {
    const row = await get(req.params.id, res.locals.user.id, true);
    const status =
      req.method === 'DELETE'
        ? 'ARCHIVED'
        : req.path.endsWith('/unpublish')
          ? 'DRAFT'
          : req.path.endsWith('/publish')
            ? 'PUBLISHED'
            : z.enum(ContentStatus).parse(req.body?.status);
    ok(
      res,
      view(
        await db.contentItem.update({
          where: { id: row.id, ownerId: res.locals.user.id },
          data: { status, isPublic: status === 'PUBLISHED' },
          include,
        }),
        false,
      ),
    );
  };
  router.patch(
    ['/content-items/:id/publish', '/content-items/:id/unpublish', '/content-items/:id/status'],
    auth,
    setStatus,
  );
  router.delete('/content-items/:id', auth, setStatus);
  router.post('/content-items/:id/duplicate', auth, async (req, res) => {
    const row = await get(req.params.id, res.locals.user.id);
    const data = await fields(
      { title: (row.title + ' · Bản sao').slice(0, 120), status: 'DRAFT' },
      row.contentType,
      row.ownerId ?? res.locals.user.id,
      row,
    );
    if (row.ownerId !== res.locals.user.id && (data.practice as Record<string, unknown>).audioId) {
      delete (data.practice as Record<string, unknown>).audioId;
      delete (data.detail as Record<string, unknown>).audioUrl;
    }
    const copy = await db.contentItem.create({
      data: {
        ...data,
        levelCode: row.levelCode,
        description: row.description,
        id: crypto.randomUUID(),
        ownerId: res.locals.user.id,
        order: 100,
        minutes: row.minutes,
      },
      include,
    });
    ok(res, view(copy, true), 201);
  });
  router.post('/content-items/:id/report', auth, async (req, res) => {
    const row = await get(req.params.id, res.locals.user.id);
    if (!row.isPublic || !row.ownerId || row.ownerId === res.locals.user.id)
      throw new ApiError(400, 'Chọn bài công khai của người khác.');
    const input = z
      .object({ reason: z.string().trim().min(2).max(100), description: z.string().max(400).optional() })
      .parse(req.body);
    const reason = [input.reason, input.description].filter(Boolean).join(' · ').slice(0, 500),
      userId = res.locals.user.id;
    await db.contentReport.upsert({
      where: { userId_lessonId: { userId, lessonId: row.id } },
      create: { userId, lessonId: row.id, reason },
      update: { reason },
    });
    ok(res, { reported: true });
  });
  return router;
}
