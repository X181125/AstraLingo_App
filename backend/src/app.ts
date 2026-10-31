import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { Prisma, type PrismaClient } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHmac, randomInt } from 'node:crypto';
import { z } from 'zod';
import type { Config } from './config.js';
import type { SendReset } from './mail.js';

class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const email = z.string().trim().toLowerCase().email('Email chưa đúng định dạng.').max(254);
const password = z.string().min(8, 'Mật khẩu cần ít nhất 8 ký tự.')
  .refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Mật khẩu quá dài (tối đa 72 byte).');
const publicUser = { id: true, name: true, email: true, nativeLang: true, targetLang: true, level: true, createdAt: true } as const;
const genericReset = 'Nếu email đã đăng ký, mã xác nhận sẽ được gửi. Vui lòng kiểm tra hộp thư.';

export function createApp(db: PrismaClient, config: Config, sendReset: SendReset) {
  const app = express();
  app.disable('x-powered-by');
  // Enable only with the single trusted Nginx hop; Compose does not publish API ports.
  if (config.TRUST_PROXY_HOPS) app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.use(helmet());
  const origins = config.CORS_ORIGINS.split(',').map(s => s.trim());
  app.use(cors({ origin(origin, cb) {
    const local = config.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1|10\.[\d.]+|192\.168\.[\d.]+|172\.(1[6-9]|2\d|3[01])\.[\d.]+):\d+$/.test(origin ?? '');
    cb(null, !origin || origins.includes(origin) || local);
  } }));
  app.use(express.json({ limit: '32kb' }));
  const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data });
  const authLimit = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { status: 429, message: 'Bạn thử quá nhiều lần. Vui lòng thử lại sau 15 phút.' } } });
  const resetLimit = rateLimit({ windowMs: 60 * 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { status: 429, message: 'Đã đạt giới hạn yêu cầu mã. Vui lòng thử lại sau.' } } });
  app.use('/api/auth', authLimit);
  const digest = (address: string, code: string) => createHmac('sha256', config.JWT_SECRET).update(`${address}:${code}`).digest('hex');
  const token = (user: { id: string; tokenVersion: number }) => jwt.sign({ ver: user.tokenVersion }, config.JWT_SECRET, {
    subject: user.id, expiresIn: '7d', issuer: 'astralingo', audience: 'astralingo-app', algorithm: 'HS256',
  });
  async function authenticated(req: Request, res: Response, next: NextFunction) {
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

  app.get('/api/health', async (_req, res) => {
    await db.$queryRaw`SELECT 1`;
    ok(res, { status: 'ok', app: 'AstraLingo', database: 'connected' });
  });
  app.post('/api/auth/register', async (req, res) => {
    const input = z.object({ name: z.string().trim().min(2, 'Tên cần ít nhất 2 ký tự.').max(60), email, password }).parse(req.body);
    const user = await db.user.create({ data: { name: input.name, email: input.email, passwordHash: await hash(input.password, 12) } });
    const safe = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: publicUser });
    ok(res, { user: safe, token: token(user) }, 201);
  });
  app.post('/api/auth/login', async (req, res) => {
    const input = z.object({ email, password: z.string().min(1).max(200) }).parse(req.body);
    const user = await db.user.findUnique({ where: { email: input.email } });
    // A fixed valid bcrypt hash keeps missing-account comparisons on the same slow path.
    const valid = await compare(input.password, user?.passwordHash ?? '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYwAQJC0vBaIvTUsWEIWRWgvJm6R8jB.');
    if (!user || !valid) throw new ApiError(401, 'Email hoặc mật khẩu chưa chính xác.');
    ok(res, { token: token(user), user: await db.user.findUnique({ where: { id: user.id }, select: publicUser }) });
  });
  app.get('/api/auth/me', authenticated, async (_req, res) => {
    ok(res, await db.user.findUnique({ where: { id: res.locals.user.id }, select: publicUser }));
  });
  app.post('/api/auth/forgot-password', resetLimit, async (req, res) => {
    const input = z.object({ email }).parse(req.body);
    const user = await db.user.findUnique({ where: { email: input.email }, include: { reset: true } });
    if (user && (!user.reset || Date.now() - user.reset.createdAt.getTime() >= 60_000)) {
      const code = randomInt(100000, 1000000).toString();
      const codeHash = digest(input.email, code);
      const data = { codeHash, expiresAt: new Date(Date.now() + 10 * 60_000), attempts: 0, createdAt: new Date() };
      await db.passwordReset.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
      try { await sendReset(input.email, code); }
      catch (err) {
        await db.passwordReset.deleteMany({ where: { userId: user.id, codeHash } });
        // Do not expose account existence or SMTP credentials in the response/log.
        console.error('Password reset delivery failed; check SMTP configuration.');
      }
    }
    ok(res, { message: genericReset });
  });
  app.post('/api/auth/reset-password', async (req, res) => {
    const input = z.object({ email, code: z.string().regex(/^\d{6}$/, 'Mã xác nhận gồm 6 chữ số.'), password }).parse(req.body);
    const user = await db.user.findUnique({ where: { email: input.email } });
    if (!user) throw new ApiError(400, 'Mã không đúng, đã hết hạn hoặc đã dùng.');
    const codeHash = digest(input.email, input.code);
    const passwordHash = await hash(input.password, 12);
    const claimed = await db.$transaction(async tx => {
      // Atomic consumption: two requests cannot reuse the same code.
      const removed = await tx.passwordReset.deleteMany({ where: { userId: user.id, codeHash, expiresAt: { gt: new Date() }, attempts: { lt: 5 } } });
      if (!removed.count) {
        await tx.passwordReset.updateMany({ where: { userId: user.id, attempts: { lt: 5 } }, data: { attempts: { increment: 1 } } });
        return false;
      }
      await tx.user.update({ where: { id: user.id }, data: { passwordHash, tokenVersion: { increment: 1 } } });
      return true;
    });
    if (!claimed) throw new ApiError(400, 'Mã không đúng, đã hết hạn hoặc đã dùng.');
    ok(res, { message: 'Đã đổi mật khẩu. Bạn có thể đăng nhập lại.' });
  });
  app.get('/api/categories', async (_req, res) => {
    ok(res, await db.category.findMany({ orderBy: { order: 'asc' }, include: { _count: { select: { courses: true } } } }));
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
    const course = await db.course.findUnique({ where: { id: String(req.params.id) }, include: { category: true, lessons: { where: { status: 'PUBLISHED' }, orderBy: { order: 'asc' } } } });
    if (!course) throw new ApiError(404, 'Không tìm thấy khóa học.');
    ok(res, course);
  });
  app.get('/api/me/enrollments', authenticated, async (_req, res) => {
    ok(res, await db.enrollment.findMany({ where: { userId: res.locals.user.id }, include: { course: { include: { category: true } } }, orderBy: { createdAt: 'desc' } }));
  });
  app.post('/api/courses/:id/enroll', authenticated, async (req, res) => {
    const courseId = String(req.params.id);
    if (!await db.course.findUnique({ where: { id: courseId } })) throw new ApiError(404, 'Không tìm thấy khóa học.');
    const userId = res.locals.user.id as string;
    ok(res, await db.enrollment.upsert({ where: { userId_courseId: { userId, courseId } }, create: { userId, courseId }, update: {} }));
  });
  app.use((_req, _res) => { throw new ApiError(404, 'API không tồn tại.'); });
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError) return res.status(400).json({ error: { status: 400, message: error.issues[0].message } });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return res.status(409).json({ error: { status: 409, message: 'Email này đã được đăng ký.' } });
    if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ error: { status: 400, message: 'Dữ liệu JSON không hợp lệ.' } });
    if (error instanceof Error && 'type' in error && error.type === 'entity.too.large') return res.status(413).json({ error: { status: 413, message: 'Dữ liệu gửi lên quá lớn.' } });
    if (error instanceof ApiError) return res.status(error.status).json({ error: { status: error.status, message: error.message } });
    console.error('API error:', error instanceof Error ? error.name : 'Unknown');
    res.status(500).json({ error: { status: 500, message: 'Máy chủ đang gặp lỗi. Vui lòng thử lại.' } });
  });
  return app;
}
