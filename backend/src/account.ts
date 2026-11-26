import { createHash, randomBytes } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import { compare, hash } from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Prisma, type PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ApiError, ok } from './http.js';
import { privateBucket } from './learning-services.js';
import { studyDate } from './study.js';
import type { Config } from './config.js';

export const publicUser = {
  id: true, name: true, email: true, nativeLang: true, targetLang: true,
  level: true, createdAt: true, preferences: true, onboardedAt: true,
} as const;
const sessionUser = { ...publicUser, tokenVersion: true } as const;
const email = z.email().max(254);
const name = z.string().trim().min(2).max(60);
const userFields = z.object({ name, nativeLang: z.enum(['vi', 'en', 'other']), level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) });
const preferenceFields = z.object({
  goal: z.enum(['study', 'work', 'travel', 'daily']),
  ageGroup: z.enum(['under18', '18-24', '25-34', '35+']),
  dailyMinutes: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(30)]),
  referral: z.enum(['friends', 'school', 'internet', 'other']),
  appearance: z.enum(['light', 'dark', 'system']).default('light'),
});
const days = 30 * 86_400_000;
const random = () => randomBytes(32).toString('base64url');
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const secret = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const provider = z.enum(['google', 'facebook']);
const flowCookie = 'astra_oauth';
type SessionUser = Prisma.UserGetPayload<{ select: typeof sessionUser }>;
type Db = Prisma.TransactionClient;

export async function issueSession(db: Db, config: Config, user: SessionUser, expiresAt = new Date(Date.now() + days), lifetime = 15 * 60) {
  const { tokenVersion, ...safe } = user;
  const refreshToken = random();
  await db.refreshSession.create({ data: { digest: digest(refreshToken), userId: user.id, version: tokenVersion, expiresAt } });
  const token = jwt.sign({ ver: tokenVersion }, config.JWT_SECRET, {
    subject: user.id, expiresIn: lifetime, issuer: 'astralingo', audience: 'astralingo-app', algorithm: 'HS256',
  });
  return { user: safe, token, refreshToken, expiresAt: Date.now() + lifetime * 1000 };
}

export async function startSession(db: PrismaClient, config: Config, userId: string, expectedVersion: number, supportsRefresh: boolean) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: sessionUser });
  if (user.tokenVersion !== expectedVersion) throw new ApiError(401, 'Phiên đã thay đổi. Vui lòng đăng nhập lại.');
  await db.refreshSession.deleteMany({ where: { userId, expiresAt: { lte: new Date() } } });
  // Released APKs only know how to keep the access token.
  const lifetime = supportsRefresh ? 15 * 60 : 7 * 86_400;
  return issueSession(db, config, user, undefined, lifetime);
}

function providers(config: Config) {
  if (!config.SUPABASE_URL || !config.SUPABASE_AUTH_KEY || !config.OAUTH_CALLBACK_URL) return [];
  const scheme = new URL(config.OAUTH_CALLBACK_URL);
  const safeOrigin = scheme.protocol === 'https:' || (config.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(scheme.hostname));
  if (!safeOrigin || scheme.search || scheme.hash || !scheme.pathname.endsWith('/api/auth/social/callback')) return [];
  return provider.options.filter(item => config.OAUTH_PROVIDERS?.split(',').map(value => value.trim()).includes(item));
}

function broker(config: Config, verifier?: string) {
  let currentVerifier = verifier;
  const client = createClient(config.SUPABASE_URL!, config.SUPABASE_AUTH_KEY!, {
    auth: {
      flowType: 'pkce', autoRefreshToken: false, detectSessionInUrl: false, persistSession: true,
      storage: {
        getItem: key => key.endsWith('-code-verifier') ? currentVerifier ?? null : null,
        setItem: (key, value) => { if (key.endsWith('-code-verifier')) currentVerifier = value; },
        removeItem: key => { if (key.endsWith('-code-verifier')) currentVerifier = undefined; },
      },
    },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) },
  });
  return { auth: client.auth, verifier: () => currentVerifier };
}

export function sessionRouter(db: PrismaClient, config: Config) {
  const router = Router();
  router.post('/refresh', async (req, res) => {
    const { refreshToken } = z.object({ refreshToken: secret }).parse(req.body);
    const key = digest(refreshToken);
    const now = new Date();
    const result = await db.$transaction(async tx => {
      const entry = await tx.refreshSession.findUnique({ where: { digest: key }, include: { user: { select: sessionUser } } });
      if (!entry || entry.version !== entry.user.tokenVersion || entry.expiresAt <= now) return null;
      const removed = await tx.refreshSession.deleteMany({ where: { digest: key } });
      if (!removed.count) return null;
      return issueSession(tx, config, entry.user, entry.expiresAt);
    });
    if (!result) throw new ApiError(401, 'Phiên đã hết hạn. Vui lòng đăng nhập lại.');
    ok(res, result);
  });

  router.post('/logout', async (req, res) => {
    const { refreshToken } = z.object({ refreshToken: secret }).parse(req.body);
    await db.refreshSession.deleteMany({ where: { digest: digest(refreshToken) } });
    ok(res, { signedOut: true });
  });

  router.get('/social/providers', (_req, res) => ok(res, providers(config)));

  router.post('/social/start', async (req, res) => {
    const { network, platform } = z.object({ network: provider, platform: z.enum(['web', 'native']) }).parse(req.body);
    if (!providers(config).includes(network)) throw new ApiError(503, 'Phương thức đăng nhập này chưa được cấu hình.');
    const id = random();
    const proof = random();
    await db.socialFlow.deleteMany({ where: { expiresAt: { lte: new Date() } } });
    await db.socialFlow.create({ data: { id, proofHash: digest(proof), provider: network, platform, expiresAt: new Date(Date.now() + 10 * 60_000) } });
    const launch = new URL('launch', config.OAUTH_CALLBACK_URL!);
    launch.searchParams.set('flow', id);
    ok(res, { id, proof, url: launch.href }, 201);
  });

  router.get('/social/launch', async (req, res) => {
    const id = secret.parse(req.query.flow);
    const flow = await db.socialFlow.findFirst({ where: { id, expiresAt: { gt: new Date() }, verifier: null, userId: null, failure: null } });
    if (!flow || !providers(config).some(item => item === flow.provider)) throw new ApiError(404, 'Yêu cầu đăng nhập đã hết hạn.');
    const session = broker(config);
    const result = await session.auth.signInWithOAuth({ provider: provider.parse(flow.provider), options: {
      redirectTo: config.OAUTH_CALLBACK_URL, skipBrowserRedirect: true,
    } });
    const verifier = session.verifier();
    if (result.error || !result.data.url || !verifier) throw new ApiError(502, 'Không mở được trang đăng nhập.');
    const updated = await db.socialFlow.updateMany({ where: { id, verifier: null, userId: null }, data: { verifier } });
    if (!updated.count) throw new ApiError(409, 'Trang đăng nhập đã được mở.');
    res.cookie(flowCookie, id, { httpOnly: true, secure: config.OAUTH_CALLBACK_URL!.startsWith('https:'), sameSite: 'lax',
      path: '/api/auth/social/callback', maxAge: 10 * 60_000 });
    res.redirect(result.data.url);
  });

  router.get('/social/callback', async (req, res) => {
    const match = req.headers.cookie?.match(/(?:^|;\s*)astra_oauth=([A-Za-z0-9_-]{43})(?:;|$)/);
    const id = match?.[1];
    const flow = id && await db.socialFlow.findFirst({ where: { id, expiresAt: { gt: new Date() }, verifier: { not: null } } });
    if (!flow || !flow.verifier) throw new ApiError(400, 'Phiên đăng nhập đã hết hạn. Hãy mở lại từ AstraLingo.');
    const claimed = await db.socialFlow.updateMany({ where: { id: flow.id, verifier: flow.verifier }, data: { verifier: null } });
    if (!claimed.count) throw new ApiError(409, 'Phiên đăng nhập đã được xử lý.');
    res.clearCookie(flowCookie, { path: '/api/auth/social/callback', httpOnly: true, sameSite: 'lax', secure: config.OAUTH_CALLBACK_URL!.startsWith('https:') });
    try {
      const code = z.string().min(1).max(512).parse(req.query.code);
      const result = await broker(config, flow.verifier).auth.exchangeCodeForSession(code);
      const profile = result.data.user;
      const identity = profile?.identities?.find(item => item.provider === flow.provider);
      const address = email.safeParse(profile?.email?.trim().toLowerCase());
      if (result.error || !profile?.email_confirmed_at || !identity || !address.success) {
        throw new ApiError(400, 'Tài khoản mạng xã hội cần có email đã xác minh.');
      }
      const where = { provider_subject: { provider: flow.provider, subject: identity.id } };
      const existing = await db.socialIdentity.findUnique({ where, include: { user: { select: { id: true, tokenVersion: true } } } });
      let user = existing?.user;
      if (!user) {
        if (await db.user.findUnique({ where: { email: address.data }, select: { id: true } })) {
          throw new ApiError(409, 'Email đã có tài khoản AstraLingo. Hãy đăng nhập bằng mật khẩu.');
        }
        const displayName = name.safeParse(profile.user_metadata?.full_name ?? profile.user_metadata?.name);
        user = await db.user.create({
          data: { email: address.data, name: displayName.success ? displayName.data : 'Người học',
            passwordHash: await hash(random(), 12), identities: { create: where.provider_subject } },
          select: { id: true, tokenVersion: true },
        });
      }
      const ticket = random();
      await db.socialFlow.update({ where: { id: flow.id }, data: { userId: user.id, version: user.tokenVersion, ticketHash: digest(ticket) } });
      const target = flow.platform === 'web'
        ? new URL('/social-return', config.OAUTH_CALLBACK_URL!)
        : new URL('astralingo://social-return');
      target.searchParams.set('ticket', ticket);
      if (flow.platform === 'web') return res.redirect(303, target.href);
      return res.type('html').send(`<!doctype html><html lang="vi"><meta charset="utf-8"><title>AstraLingo</title><p><a href="${target.href}">Quay lại AstraLingo để đăng nhập</a></p></html>`);
    } catch (error) {
      const failure = error instanceof ApiError ? error.message : 'Không xác thực được tài khoản. Hãy thử lại.';
      await db.socialFlow.update({ where: { id: flow.id }, data: { failure } });
      res.status(400).type('text').send(failure);
    }
  });

  router.post('/social/complete', async (req, res) => {
    const { id, proof, ticket } = z.object({ id: secret, proof: secret, ticket: secret }).parse(req.body);
    const scope = { id, proofHash: digest(proof), ticketHash: digest(ticket), expiresAt: { gt: new Date() } };
    const result = await db.$transaction(async tx => {
      const flow = await tx.socialFlow.findFirst({ where: scope });
      if (!flow) throw new ApiError(404, 'Phiên đăng nhập đã hết hạn.');
      if (flow.failure) throw new ApiError(400, flow.failure);
      if (!flow.userId) throw new ApiError(400, 'Phiên đăng nhập chưa sẵn sàng.');
      const user = await tx.user.findUnique({ where: { id: flow.userId }, select: sessionUser });
      if (!user || user.tokenVersion !== flow.version) throw new ApiError(401, 'Phiên đã thay đổi. Vui lòng đăng nhập lại.');
      const claimed = await tx.socialFlow.deleteMany({ where: scope });
      if (!claimed.count) throw new ApiError(409, 'Phiên đã được hoàn tất.');
      return issueSession(tx, config, user);
    });
    ok(res, result);
  });
  return router;
}

export function accountRouter(db: PrismaClient, config: Config, auth: RequestHandler) {
  const router = Router();
  router.use(auth);

  router.put('/onboarding', async (req, res) => {
    const id = res.locals.user.id as string;
    const { preferences, ...profile } = userFields.omit({ name: true }).extend({ preferences: preferenceFields }).parse(req.body);
    ok(res, await db.user.update({ where: { id }, data: { ...profile, preferences, onboardedAt: new Date() }, select: publicUser }));
  });

  router.patch('/profile', async (req, res) => {
    const id = res.locals.user.id as string;
    const { appearance, dailyMinutes, ...data } = userFields.partial().extend({
      appearance: preferenceFields.shape.appearance.optional(), dailyMinutes: preferenceFields.shape.dailyMinutes.optional(),
    }).parse(req.body);
    const user = await db.user.findUniqueOrThrow({ where: { id }, select: { preferences: true } });
    const preferences = user.preferences && typeof user.preferences === 'object' && !Array.isArray(user.preferences) ? user.preferences : {};
    ok(res, await db.user.update({ where: { id }, data: { ...data, preferences: {
      ...preferences, ...(appearance === undefined ? {} : { appearance }), ...(dailyMinutes === undefined ? {} : { dailyMinutes }),
    } }, select: publicUser }));
  });

  router.get('/progress', async (_req, res) => {
    const userId = res.locals.user.id as string;
    const [summary, scores, reviewCount, days, shortQuizzes, exams] = await Promise.all([
      db.studyAttempt.groupBy({ by: ['mode', 'state'], where: { userId, state: { in: ['SUBMITTED', 'COMPLETED'] } }, _count: { _all: true } }),
      db.studyAttempt.findMany({ where: { userId, score: { not: null } }, select: { score: true, lesson: { select: { contentType: true } } } }),
      db.cardReview.count({ where: { userId } }),
      db.studyDay.findMany({ where: { userId }, orderBy: { day: 'desc' }, take: 366, select: { day: true } }),
      db.quizAttempt.count({ where: { userId, result: { not: Prisma.DbNull } } }),
      db.examAttempt.count({ where: { userId, submittedAt: { not: null } } }),
    ]);
    const daySet = new Set(days.map(entry => entry.day));
    let cursor = Date.parse(studyDate() + 'T00:00:00Z');
    if (!daySet.has(studyDate())) cursor -= 86_400_000;
    let streak = 0;
    while (daySet.has(new Date(cursor).toISOString().slice(0, 10))) { streak++; cursor -= 86_400_000; }
    const skills = (['READING', 'LISTENING', 'SPEAKING', 'WRITING'] as const).map(skill => {
      const values = scores.filter(item => item.lesson.contentType === skill).map(item => item.score!);
      return { skill, graded: values.length, average: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null };
    });
    ok(res, { attempts: summary.reduce((sum, item) => sum + item._count._all, 0), completedQuizzes: shortQuizzes + exams,
      reviewedCards: reviewCount, streak, recentDays: days.slice(0, 7).map(entry => entry.day), skills });
  });

  router.delete('/profile', async (req, res) => {
    const account = res.locals.user as { id: string; email: string; passwordHash: string; tokenVersion: number };
    const { password, confirmation } = z.object({
      password: z.string().min(1).refine(value => Buffer.byteLength(value, 'utf8') <= 72), confirmation: z.literal('XÓA'),
    }).parse(req.body);
    if (!await compare(password, account.passwordHash)) throw new ApiError(400, 'Mật khẩu chưa chính xác. Nếu đăng nhập mạng xã hội, đặt mật khẩu trước.');
    const items = await db.studyMedia.findMany({ where: { ownerId: account.id, objectKey: { not: null } }, select: { objectKey: true } });
    const bucket = privateBucket(config);
    if (items.length && !bucket) throw new ApiError(503, 'Kho âm thanh chưa sẵn sàng để xóa tài khoản.');
    for (let offset = 0; bucket && offset < items.length; offset += 100) {
      const { error } = await bucket.remove(items.slice(offset, offset + 100).map(item => item.objectKey!));
      if (error) throw new ApiError(502, 'Chưa xóa được âm thanh. Bạn có thể thử lại.');
    }
    await db.$transaction(async tx => {
      const removed = await tx.user.deleteMany({ where: { id: account.id, tokenVersion: account.tokenVersion } });
      if (!removed.count) throw new ApiError(409, 'Tài khoản đã thay đổi. Đăng nhập lại và thử lại.');
      await tx.socialFlow.deleteMany({ where: { userId: account.id } });
    });
    ok(res, { deleted: confirmation === 'XÓA' });
  });
  return router;
}
