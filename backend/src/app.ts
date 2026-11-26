import { questionBank } from './question-bank.js';
import { speechReviewRoutes } from './speech-review.js';
import { recordingRoutes } from './recordings.js';
import { passageWordRoutes } from './passage-words.js';
import { passageRoutes } from './passage.js';
import { tutorRoutes } from './tutor.js';
import { assessmentRoutes } from './assessments.js';
import { submissionRoutes } from './submissions.js';
import { catalogRoutes } from './catalog.js';
import { flashcardRoutes } from './flashcards.js';
import { dictionaryRouter } from "./dictionary.js";
import { examRoutes } from "./exams.js";
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { Prisma, type PrismaClient } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Config } from './config.js';
import type { SendReset } from './mail.js';
import { ApiError, ok } from './http.js';
import { accountRouter, publicUser, sessionRouter, startSession } from './account.js';
import { studyRouter } from './study.js';
import { vocabularyRouter } from './vocabulary.js';

const email = z.string().trim().toLowerCase().email('Email chưa đúng định dạng.').max(254);
const password = z.string().min(8, 'Mật khẩu cần ít nhất 8 ký tự.')
  .refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Mật khẩu quá dài (tối đa 72 byte).');
const genericReset = 'Nếu email đã đăng ký, mã xác nhận sẽ được gửi. Vui lòng kiểm tra hộp thư.';

export function createApp(db: PrismaClient, config: Config, sendReset: SendReset) {
  const app = express();
  app.disable('x-powered-by');
  // Enable only with the single trusted Nginx hop; Compose does not publish API ports.
  if (config.TRUST_PROXY_HOPS) app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.use(helmet());
  // Authenticated API responses must never be cached by browsers or shared proxies.
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const origins = config.CORS_ORIGINS.split(',').map(s => s.trim());
  app.use(cors({ origin(origin, cb) {
    const local = config.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1|10\.[\d.]+|192\.168\.[\d.]+|172\.(1[6-9]|2\d|3[01])\.[\d.]+):\d+$/.test(origin ?? '');
    cb(null, !origin || origins.includes(origin) || local);
  } }));
  const mediaLimit = rateLimit({ windowMs: 60_000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { status: 429, message: 'Vui lòng chờ trước khi tải tệp hoặc gọi AI tiếp.' } } });
  app.post(['/api/study/audio', '/api/learn/ai'], mediaLimit, authenticated, express.json({ limit: '6mb' }));
  app.post('/api/study/attempts/:id/feedback', mediaLimit);
  app.post('/api/study/lessons', authenticated, express.json({ limit: '128kb' }));
  app.put('/api/study/lessons/:id', authenticated, express.json({ limit: '128kb' }));
  app.post('/api/ai/visual-vocabulary', authenticated, express.json({limit:'6mb'}));
  app.use(express.json({ limit: '32kb' }));
  const authLimit = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { status: 429, message: 'Bạn thử quá nhiều lần. Vui lòng thử lại sau 15 phút.' } } });
  const resetLimit = rateLimit({ windowMs: 60 * 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { status: 429, message: 'Đã đạt giới hạn yêu cầu mã. Vui lòng thử lại sau.' } } });
  app.use(['/api/auth/register', '/api/auth/login', '/api/auth/forgot-password', '/api/auth/reset-password',
    '/api/auth/refresh', '/api/auth/social/start', '/api/auth/social/complete'], authLimit);
  const digest = (address: string, code: string) => createHmac('sha256', config.JWT_SECRET).update(`${address}:${code}`).digest('hex');
  async function authenticated(req: Request, res: Response, next: NextFunction) {
    if (res.locals.user) return next();
    const bearer = req.headers.authorization;
    if (!bearer?.startsWith('Bearer ')) throw new ApiError(401, 'Vui lòng đăng nhập để tiếp tục.');
    let payload: jwt.JwtPayload;
    try {
      const parsed = jwt.verify(bearer.slice(7), config.JWT_SECRET, { algorithms: ['HS256'], issuer: 'astralingo', audience: 'astralingo-app' });
      if (typeof parsed === 'string' || !parsed.sub) throw new Error();
      payload = parsed;
    } catch { throw new ApiError(401, 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.'); }
    const user = await db.user.findUnique({ where: { id: payload.sub! } });
    if (!user || user.tokenVersion !== payload.ver) throw new ApiError(401, 'Phiên đăng nhập không còn hiệu lực.');
    res.locals.user = user;
    next();
  }

  app.use('/api', tutorRoutes(db, config, authenticated, mediaLimit));
  app.use('/api/media/listening', express.static('resources/listening', {index:false, dotfiles:'deny'}));
  app.use('/api', recordingRoutes(db, config, authenticated, mediaLimit));
  app.use('/api', passageWordRoutes(db, authenticated));
  app.use('/api', questionBank(db, config, authenticated, mediaLimit));
  app.use('/api', speechReviewRoutes(db, config, authenticated, mediaLimit));
  app.use('/api', passageRoutes(db, authenticated));
  app.use('/api', assessmentRoutes(db, config, authenticated, mediaLimit));
  app.use('/api', submissionRoutes(db, config, authenticated, mediaLimit));
  app.use('/api', catalogRoutes(db, authenticated));
  app.use('/api', flashcardRoutes(db, authenticated));
  app.use('/api/words', dictionaryRouter(authenticated));
  app.use('/api/exams', examRoutes(db, authenticated));
  app.get('/api/health', async (_req, res) => {
    await db.$queryRaw`SELECT 1`;
    ok(res, { status: 'ok', app: 'AstraLingo', database: 'connected' });
  });
  app.post('/api/auth/register', async (req, res) => {
    const input = z.object({ name: z.string().trim().min(2, 'Tên cần ít nhất 2 ký tự.').max(60), email, password, supportsRefresh: z.boolean().default(false) }).parse({ ...req.body, name: req.body?.name ?? req.body?.fullName });
    const user = await db.user.create({ data: { name: input.name, email: input.email, passwordHash: await hash(input.password, 12) } });
    const session = await startSession(db, config, user.id, user.tokenVersion, input.supportsRefresh);
    ok(res, { ...session, id: user.id, user: { ...session.user, fullName: user.name } }, 201);
  });
  app.post('/api/auth/login', async (req, res) => {
    const input = z.object({ email, password: z.string().min(1).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Mật khẩu quá dài (tối đa 72 byte).'),
      supportsRefresh: z.boolean().default(false) }).parse(req.body);
    const user = await db.user.findUnique({ where: { email: input.email } });
    // A fixed valid bcrypt hash keeps missing-account comparisons on the same slow path.
    const valid = await compare(input.password, user?.passwordHash ?? '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYwAQJC0vBaIvTUsWEIWRWgvJm6R8jB.');
    if (!user || !valid) throw new ApiError(401, 'Email hoặc mật khẩu chưa chính xác.');
    const session = await startSession(db, config, user.id, user.tokenVersion, input.supportsRefresh);
    ok(res, { ...session, user: { ...session.user, fullName: user.name } });
  });
  app.get('/api/auth/me', authenticated, async (_req, res) => {
    ok(res, await db.user.findUnique({ where: { id: res.locals.user.id }, select: publicUser }));
  });
  app.post('/api/auth/forgot-password', resetLimit, async (req, res) => {
    const input = z.object({ email }).parse(req.body);
    const user = await db.user.findUnique({ where: { email: input.email } });
    if (user) {
      const code = randomInt(100000, 1000000).toString();
      const codeHash = digest(input.email, code);
      const createdAt = new Date();
      const expiresAt = new Date(+createdAt + 10 * 60_000);
      const id = randomUUID();
      // One atomic statement claims the resend window across processes without long-lived locks.
      // Explicit UTC matches Prisma's timestamp columns. Allow replacing legacy rows dated far in the future.
      const issued = await db.$queryRaw<{ id: string }[]>`
        INSERT INTO "PasswordReset" ("id", "userId", "codeHash", "expiresAt", "attempts", "createdAt")
        VALUES (${id}, ${user.id}, ${codeHash}, ${expiresAt}::timestamptz AT TIME ZONE 'UTC', 0, ${createdAt}::timestamptz AT TIME ZONE 'UTC')
        ON CONFLICT ("userId") DO UPDATE SET
          "id" = EXCLUDED."id",
          "codeHash" = EXCLUDED."codeHash", "expiresAt" = EXCLUDED."expiresAt",
          "attempts" = 0, "createdAt" = EXCLUDED."createdAt"
        WHERE "PasswordReset"."createdAt" <= EXCLUDED."createdAt" - INTERVAL '60 seconds'
           OR "PasswordReset"."createdAt" > EXCLUDED."createdAt" + INTERVAL '60 seconds'
        RETURNING "id"`;
      if (!issued.length) return ok(res, { message: genericReset });
      try { await sendReset(input.email, code); }
      catch (err) {
        await db.passwordReset.deleteMany({ where: { id } });
        // Do not expose account existence or SMTP credentials in the response/log.
        console.error('Password reset delivery failed; check SMTP configuration.');
      }
    }
    ok(res, { message: genericReset });
  });
  app.post('/api/auth/reset-password', async (req, res) => {
    const startedAt = new Date();
    const input = z.object({ email, code: z.string().regex(/^\d{6}$/, 'Mã xác nhận gồm 6 chữ số.'), password }).parse(req.body);
    const user = await db.user.findUnique({ where: { email: input.email }, select: { id: true, reset: true } });
    const reset = user?.reset;
    const invalidCode = new ApiError(400, 'Mã không đúng, đã hết hạn hoặc đã dùng.');
    if (!user || !reset || reset.createdAt > startedAt || reset.expiresAt <= new Date() || reset.attempts >= 5) throw invalidCode;
    const codeHash = digest(input.email, input.code);
    const currentReset = { id: reset.id, createdAt: reset.createdAt, codeHash: reset.codeHash };
    if (codeHash !== reset.codeHash) {
      await db.passwordReset.updateMany({
        where: { ...currentReset, expiresAt: { gt: new Date() }, attempts: { lt: 5 } },
        data: { attempts: { increment: 1 } },
      });
      throw invalidCode;
    }
    const passwordHash = await hash(input.password, 12);
    const claimed = await db.$transaction(async tx => {
      // Atomic consumption: two requests cannot reuse the same code.
      const removed = await tx.passwordReset.deleteMany({ where: { ...currentReset, expiresAt: { gt: new Date() }, attempts: { lt: 5 } } });
      if (!removed.count) return false;
      await tx.user.update({ where: { id: user.id }, data: { passwordHash, tokenVersion: { increment: 1 } } });
      return true;
    });
    if (!claimed) throw invalidCode;
    ok(res, { message: 'Đã đổi mật khẩu. Bạn có thể đăng nhập lại.' });
  });
  app.get('/api/categories', async (_req, res) => {
    ok(res, await db.category.findMany({ orderBy: { order: 'asc' }, include: { _count: { select: { courses: { where: { language: 'en' } } } } } }));
  });
  app.get('/api/courses', async (req, res) => {
    const q = z.object({ q: z.string().trim().max(100).default(''), category: z.string().max(30).optional(),
      level: z.enum(['A1', 'A2', 'B1', 'B2']).optional(), language: z.literal('en').optional(),
      page: z.coerce.number().int().min(1).max(10000).default(1), limit: z.coerce.number().int().min(1).max(50).default(12) }).parse(req.query);
    const where: Prisma.CourseWhereInput = {
      language: 'en',
      ...(q.category ? { categoryId: q.category } : {}), ...(q.level ? { level: q.level } : {}), ...(q.language ? { language: q.language } : {}),
      ...(q.q ? { OR: [{ title: { contains: q.q, mode: 'insensitive' } }, { description: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    const [items, total] = await Promise.all([
      db.course.findMany({ where, include: { category: true }, orderBy: [{ featured: 'desc' }, { id: 'asc' }], skip: (q.page - 1) * q.limit, take: q.limit }),
      db.course.count({ where }),
    ]);
    ok(res, { items, total, page: q.page, hasMore: q.page * q.limit < total });
  });
  app.get('/api/courses/:id', async (req, res) => {
    const course = await db.course.findUnique({ where: { id: String(req.params.id) }, include: { category: true, lessons: {
      where: { status: 'PUBLISHED', ownerId: null }, orderBy: { order: 'asc' },
      select: { id: true, courseId: true, title: true, contentType: true, status: true, order: true, minutes: true, preview: true, practice: true },
    } } });
    if (!course || course.language !== 'en') throw new ApiError(404, 'Không tìm thấy khóa học.');
    ok(res, { ...course, lessons: course.lessons.map(({ practice, ...lesson }) => ({ ...lesson, hasPractice: practice !== null })) });
  });
  app.get('/api/me/enrollments', authenticated, async (_req, res) => {
    ok(res, await db.enrollment.findMany({ where: { userId: res.locals.user.id, course: { language: 'en' } }, include: { course: { include: { category: true } } }, orderBy: { createdAt: 'desc' } }));
  });
  app.post('/api/courses/:id/enroll', authenticated, async (req, res) => {
    const courseId = String(req.params.id);
    if (!await db.course.findFirst({ where: { id: courseId, language: 'en' } })) throw new ApiError(404, 'Không tìm thấy khóa học.');
    const userId = res.locals.user.id as string;
    try {
      ok(res, await db.enrollment.create({ data: { userId, courseId } }));
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      ok(res, await db.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId, courseId } } }));
    }
  });
  app.use('/api/auth', sessionRouter(db, config));
  app.use('/api/account', accountRouter(db, config, authenticated));
  app.use('/api/study', studyRouter(db, config, authenticated));
  app.use('/api/learn', vocabularyRouter(db, config, authenticated));
  app.use((_req, _res) => { throw new ApiError(404, 'API không tồn tại.'); });
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError) return res.status(400).json({ error: { status: 400, message: error.issues[0].message } });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return res.status(409).json({ error: { status: 409, message: 'Email này đã được đăng ký.' } });
    if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ error: { status: 400, message: 'Dữ liệu JSON không hợp lệ.' } });
    if (error instanceof Error && 'type' in error && error.type === 'entity.too.large') return res.status(413).json({ error: { status: 413, message: 'Dữ liệu gửi lên quá lớn.' } });
    if (error instanceof ApiError) return res.status(error.status).json({ error: { status: error.status, message: error.message } });
    console.error('API error:', error instanceof Error ? error.name : 'Unknown', error instanceof Prisma.PrismaClientKnownRequestError ? error.code : '');
    res.status(500).json({ error: { status: 500, message: 'Máy chủ đang gặp lỗi. Vui lòng thử lại.' } });
  });
  return app;
}
