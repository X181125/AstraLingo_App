import routeContract from './mobile-routes.json' with {type:'json'};
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { startPrismaDevServer } from '@prisma/dev';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { seed } from '../prisma/seed-data.js';
import type { Config } from '../src/config.js';

let local: Awaited<ReturnType<typeof startPrismaDevServer>>;
let db: PrismaClient;
let app: ReturnType<typeof createApp>;
let isolatedSchema: string | undefined;
const inbox = new Map<string, string>();
const secret = randomBytes(48).toString('hex');
const testConfig = (): Config => ({ PORT: 4001, TRUST_PROXY_HOPS: 0, NODE_ENV: 'test', DATABASE_URL: process.env.DATABASE_URL!, JWT_SECRET: secret, CORS_ORIGINS: 'http://localhost:8081', MAIL_MODE: 'console', MAIL_FROM: 'test@example.com', SMTP_PORT: 587 });
before(async () => {
  if (process.env.TEST_DATABASE_URL) {
    isolatedSchema = `test_${process.pid}_${randomBytes(6).toString('hex')}`;
    const url = new URL(process.env.TEST_DATABASE_URL);
    url.searchParams.set('schema', isolatedSchema);
    process.env.DATABASE_URL = url.toString();
  } else {
    local = await startPrismaDevServer({ name: `astralingo-test-${process.pid}`, port: 15313, databasePort: 15314, shadowDatabasePort: 15315, persistenceMode: 'stateless' });
    process.env.DATABASE_URL = local.database.connectionString;
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: process.env, stdio: 'pipe', windowsHide: true });
    let output = ''; child.stdout.on('data', x => output += x); child.stderr.on('data', x => output += x);
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(output)));
  });
  db = new PrismaClient(); await seed(db);
  const config: Config = { PORT: 4001, TRUST_PROXY_HOPS: 0, NODE_ENV: 'test', DATABASE_URL: process.env.DATABASE_URL!, JWT_SECRET: secret, CORS_ORIGINS: 'http://localhost:8081', MAIL_MODE: 'console', MAIL_FROM: 'test@example.com', SMTP_PORT: 587 };
  app = createApp(db, config, async (email, code) => { inbox.set(email, code); });
});
after(async () => {
  try {
    if (db && isolatedSchema && /^test_\d+_[a-f0-9]+$/.test(isolatedSchema)) await db.$executeRawUnsafe(`DROP SCHEMA "${isolatedSchema}" CASCADE`);
  } finally { await db?.$disconnect(); await local?.close(); }
});

test('registration, login, protected profile, search, categories and idempotent enrollment', async () => {
  await request(app).post('/api/auth/register').send({ name: 'A', email: 'bad', password: 'short' }).expect(400);
  const registered = await request(app).post('/api/auth/register').send({ name: 'Người kiểm thử', email: ' TEST@Example.com ', password: 'First@12345' }).expect(201);
  const { token, user } = registered.body.data;
  assert.equal(user.email, 'test@example.com'); assert.equal(user.passwordHash, undefined);
  await request(app).post('/api/auth/register').send({ name: 'Trùng email', email: 'test@example.com', password: 'First@12345' }).expect(409);
  await request(app).post('/api/auth/login').send({ email: user.email, password: 'wrong' }).expect(401);
  await request(app).post('/api/auth/login').send({ email: 'missing@example.com', password: 'wrong' }).expect(401);
  await request(app).get('/api/auth/me').expect(401);
  await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid').expect(401);
  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
  assert.equal(me.body.data.id, user.id);
  const categories = await request(app).get('/api/categories').expect(200); assert.equal(categories.body.data.length, 5);
  const courses = await request(app).get('/api/courses').expect(200); assert.equal(courses.body.data.total, 5);
  assert.ok(courses.body.data.items.every((course: { language: string }) => course.language === 'en'));
  await request(app).get('/api/courses?language=ja').expect(400);
  await request(app).get('/api/courses/japanese-hello').expect(404);
  const filtered = await request(app).get('/api/courses?category=reading&level=A2&language=en&q=thú%20vị').expect(200); assert.equal(filtered.body.data.total, 1);
  const empty = await request(app).get('/api/courses?q=zzzzzz').expect(200); assert.equal(empty.body.data.total, 0);
  await request(app).get('/api/courses?limit=-1').expect(400);
  await request(app).get('/api/courses/nonexistent').expect(404);
  const detail = await request(app).get('/api/courses/english-first-steps').expect(200); assert.equal(detail.body.data.lessons.length, 4);
  await request(app).post('/api/courses/english-first-steps/enroll').expect(401);
  for (let i = 0; i < 2; i++) await request(app).post('/api/courses/english-first-steps/enroll').set('Authorization', `Bearer ${token}`).expect(200);
  const list = await request(app).get('/api/me/enrollments').set('Authorization', `Bearer ${token}`).expect(200); assert.equal(list.body.data.length, 1);
  // Another account cannot see this enrollment.
  const second = await request(app).post('/api/auth/register').send({ name: 'Bạn thứ hai', email: 'second@example.com', password: 'Second@12345' }).expect(201);
  const secondList = await request(app).get('/api/me/enrollments').set('Authorization', `Bearer ${second.body.data.token}`).expect(200); assert.equal(secondList.body.data.length, 0);
});

test('reset is non-enumerating, rejects bad codes, consumes code once and revokes old JWT', async () => {
  const email = 'test@example.com';
  const login = await request(app).post('/api/auth/login').send({ email, password: 'First@12345' }).expect(200);
  const known = await request(app).post('/api/auth/forgot-password').send({ email }).expect(200);
  const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'absent@example.com' }).expect(200);
  assert.deepEqual(known.body, unknown.body); assert.equal(known.body.data.code, undefined);
  const code = inbox.get(email)!; assert.match(code, /^\d{6}$/);
  await request(app).post('/api/auth/reset-password').send({ email, code: '000000', password: 'Changed@12345' }).expect(400);
  await request(app).post('/api/auth/reset-password').send({ email, code, password: 'Changed@12345' }).expect(200);
  await request(app).post('/api/auth/reset-password').send({ email, code, password: 'Again@12345' }).expect(400);
  await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.data.token}`).expect(401);
  await request(app).post('/api/auth/login').send({ email, password: 'First@12345' }).expect(401);
  await request(app).post('/api/auth/login').send({ email, password: 'Changed@12345' }).expect(200);
});

test('expired codes and five failed attempts cannot reset a password', async () => {
  const user = await db.user.findUniqueOrThrow({ where: { email: 'second@example.com' } });
  const code = '123456';
  const codeHash = createHmac('sha256', secret).update(`${user.email}:${code}`).digest('hex');
  await db.passwordReset.create({ data: { userId: user.id, codeHash, expiresAt: new Date(Date.now() - 1000) } });
  await request(app).post('/api/auth/reset-password').send({ email: user.email, code, password: 'Changed@12345' }).expect(400);
  await db.passwordReset.update({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() + 600_000), attempts: 4 } });
  await request(app).post('/api/auth/reset-password').send({ email: user.email, code: '000000', password: 'Changed@12345' }).expect(400);
  await request(app).post('/api/auth/reset-password').send({ email: user.email, code, password: 'Changed@12345' }).expect(400);
});

test('malformed and oversized JSON are client errors; proxy clients have separate rate limits', async () => {
  await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{').expect(400);
  await request(app).post('/api/auth/login').send({ payload: 'x'.repeat(33 * 1024) }).expect(413);
  const proxied = createApp(db, {
    PORT: 4001, TRUST_PROXY_HOPS: 1, NODE_ENV: 'test', DATABASE_URL: process.env.DATABASE_URL!,
    JWT_SECRET: secret, CORS_ORIGINS: 'http://localhost:8080', MAIL_MODE: 'console',
    MAIL_FROM: 'test@example.com', SMTP_PORT: 587,
  }, async () => {});
  for (let i = 0; i < 30; i++) {
    await request(proxied).post('/api/auth/login').set('X-Forwarded-For', '192.0.2.1').send({}).expect(400);
  }
  await request(proxied).post('/api/auth/login').set('X-Forwarded-For', '192.0.2.1').send({}).expect(429);
  await request(proxied).post('/api/auth/login').set('X-Forwarded-For', '192.0.2.2').send({}).expect(400);
});

test('bcrypt does not accept a password with extra bytes past its 72-byte limit', async () => {
  const instance = createApp(db, testConfig(), async () => {});
  const password = 'é'.repeat(36);
  await request(instance).post('/api/auth/register').send({ name: 'Byte limit', email: 'bytes@example.test', password }).expect(201);
  await request(instance).post('/api/auth/login').send({ email: 'bytes@example.test', password: password + 'different' }).expect(400);
  await request(instance).post('/api/auth/login').send({ email: 'bytes@example.test', password }).expect(200);
});

test('restoring a session does not exhaust the login budget and personal data is not cached', async () => {
  const instance = createApp(db, testConfig(), async () => {});
  const session = await request(instance).post('/api/auth/register').send({ name: 'Session test', email: 'session@example.test', password: 'Session@12345' }).expect(201);
  for (let i = 0; i < 35; i++) {
    const me = await request(instance).get('/api/auth/me').set('Authorization', `Bearer ${session.body.data.token}`).expect(200);
    assert.match(me.headers['cache-control'] || '', /no-store/);
  }
  await request(instance).post('/api/auth/login').send({ email: 'session@example.test', password: 'Session@12345' }).expect(200);
});

test('concurrent reset requests send one code; concurrent consumption succeeds only once', async () => {
  const sent: string[] = [];
  const instance = createApp(db, testConfig(), async (_email, code) => { sent.push(code); });
  const email = 'concurrent@example.test';
  await request(instance).post('/api/auth/register').send({ name: 'Concurrent reset', email, password: 'Before@12345' }).expect(201);
  const issued = await Promise.all(Array.from({ length: 4 }, () => request(instance).post('/api/auth/forgot-password').send({ email })));
  assert.deepEqual(issued.map(r => r.status), [200, 200, 200, 200]);
  assert.equal(sent.length, 1);
  const responses = await Promise.all(Array.from({ length: 2 }, () => request(instance).post('/api/auth/reset-password').send({ email, code: sent[0], password: 'After@12345' })));
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 400]);
});

test('non-English courses are excluded from detail, enrollment and category counts', async () => {
  const instance = createApp(db, testConfig(), async () => {});
  const before = (await request(instance).get('/api/categories')).body.data;
  await db.course.create({ data: { id: 'hidden-other-language', title: 'Other', description: 'Not English', language: 'fr', level: 'A1', minutes: 10, lessonsCount: 0, accent: '#fff', illustration: 'book', categoryId: 'reading' } });
  const session = await request(instance).post('/api/auth/login').send({ email: 'session@example.test', password: 'Session@12345' }).expect(200);
  await request(instance).get('/api/courses/hidden-other-language').expect(404);
  await request(instance).post('/api/courses/hidden-other-language/enroll').set('Authorization', `Bearer ${session.body.data.token}`).expect(404);
  assert.deepEqual((await request(instance).get('/api/categories')).body.data, before);
});

test('concurrent normalized signup and enrollment preserve unique ownership', async () => {
  const instance = createApp(db, testConfig(), async () => {});
  const password = 'Unique@12345';
  const registrations = await Promise.all([' Concurrent-Owner@EXAMPLE.test ', 'concurrent-owner@example.test'].map(email =>
    request(instance).post('/api/auth/register').send({ name: 'Nguyễn 😃', email, password })));
  assert.deepEqual(registrations.map(r => r.status).sort(), [201, 409]);
  const { token, user } = registrations.find(r => r.status === 201)!.body.data;
  assert.equal(user.email, 'concurrent-owner@example.test');
  const enrollments = await Promise.all(Array.from({ length: 6 }, () =>
    request(instance).post('/api/courses/english-first-steps/enroll').set('Authorization', `Bearer ${token}`)));
  assert.deepEqual(enrollments.map(r => r.status), [200, 200, 200, 200, 200, 200]);
  assert.equal(await db.enrollment.count({ where: { userId: user.id } }), 1);
});

test('a reset request started before a resend cannot penalize the replacement OTP', async () => {
  const address = 'reset-rotation@example.test';
  const user = await db.user.create({ data: { email: address, name: 'Reset Rotation', passwordHash: 'unused' } });
  const oldCode = '123456';
  const newCode = '654321';
  const codeHash = (code: string) => createHmac('sha256', secret).update(`${address}:${code}`).digest('hex');
  await db.passwordReset.create({ data: {
    userId: user.id, codeHash: codeHash(oldCode), createdAt: new Date(Date.now() - 61_000), expiresAt: new Date(Date.now() + 300_000),
  } });
  const updateObserved = db.$extends({ query: { user: { async findUnique({ args, query }) {
    const result = await query(args);
    if (args.where.email === address) {
      await db.passwordReset.update({ where: { userId: user.id }, data: { codeHash: codeHash(newCode), createdAt: new Date() } });
    }
    return result;
  } } } }) as unknown as PrismaClient;
  const instance = createApp(updateObserved, testConfig(), async () => {});
  await request(instance).post('/api/auth/reset-password').send({ email: address, code: oldCode, password: 'Changed@12345' }).expect(400);
  assert.equal((await db.passwordReset.findUniqueOrThrow({ where: { userId: user.id } })).attempts, 0);
});

test('reset TTL and resend cooldown use UTC even in a non-UTC database session', async () => {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set('connection_limit', '1');
  const session = new PrismaClient({ datasourceUrl: url.toString() });
  try {
    await session.$executeRaw`SET TIME ZONE 'Asia/Ho_Chi_Minh'`;
    const user = await session.user.create({ data: { email: 'reset-tz@example.test', name: 'Time Zone', passwordHash: 'unused' } });
    const codes: string[] = [];
    const instance = createApp(session, testConfig(), async (_email, code) => { codes.push(code); });
    const before = Date.now();
    const send = () => request(instance).post('/api/auth/forgot-password').send({ email: user.email }).expect(200);
    await send();
    const reset = await session.passwordReset.findUniqueOrThrow({ where: { userId: user.id } });
    assert.ok(+reset.createdAt >= before && +reset.createdAt <= Date.now());
    assert.equal(+reset.expiresAt - +reset.createdAt, 600_000);
    await send();
    assert.equal(codes.length, 1);
    await session.passwordReset.update({ where: { id: reset.id }, data: { createdAt: new Date(Date.now() - 61_000) } });
    await send();
    assert.equal(codes.length, 2);
    assert.notEqual((await session.passwordReset.findUniqueOrThrow({ where: { userId: user.id } })).id, reset.id);
  } finally {
    await session.$disconnect();
  }
});

test('SMTP failure gives the same public response and permits retry', async () => {
  const user = await db.user.create({ data: { email: 'reset-mail@example.test', name: 'Mail Retry', passwordHash: 'unused' } });
  let sends = 0;
  const instance = createApp(db, testConfig(), async () => {
    if (++sends === 1) throw new Error('injected transport failure');
  });
  const send = (email: string) => request(instance).post('/api/auth/forgot-password').send({ email }).expect(200);
  const missing = await send('not-registered@example.test');
  const failure = await send(user.email);
  assert.deepEqual(failure.body, missing.body);
  assert.equal(await db.passwordReset.findUnique({ where: { userId: user.id } }), null);
  await send(user.email);
  assert.equal(sends, 2);
  assert.ok(await db.passwordReset.findUnique({ where: { userId: user.id } }));
});

test('study content checks ownership, hides answers and stores submissions and progress', async () => {
  const instance = createApp(db, testConfig(), async () => {});
  const register = (email: string) => request(instance).post('/api/auth/register')
    .send({ name: 'Study Tester', email, password: 'Testing@12345' }).expect(201).then(result => result.body.data);
  const owner = await register('study-owner@example.test');
  const learner = await register('study-learner@example.test');
  const ownerHeaders = { Authorization: `Bearer ${owner.token}` };
  const learnerHeaders = { Authorization: `Bearer ${learner.token}` };
  const data = { courseId: 'english-first-steps', contentType: 'READING', title: 'Short lesson',
    body: 'We meet at noon.', questions: [{ prompt: 'When?', options: ['At noon', 'At 3'], answer: 0 }] };
  const created = await request(instance).post('/api/study/lessons').set(ownerHeaders).send(data).expect(201);
  const path = `/api/study/lessons/${created.body.data.id}`;
  await request(instance).get(path).set(learnerHeaders).expect(404);
  await request(instance).put(path).set(learnerHeaders).send(data).expect(404);
  await request(instance).put(path).set(ownerHeaders).send({ ...data, status: 'PUBLISHED', isPublic: true }).expect(200);
  const visible = await request(instance).get(path).set(learnerHeaders).expect(200);
  assert.deepEqual(visible.body.data.questions, [{ prompt: 'When?', options: ['At noon', 'At 3'] }]);
  const graded = await request(instance).post(path + '/assessment').set(learnerHeaders).send({ answers: [0] }).expect(201);
  assert.equal(graded.body.data.score, 100);
  await request(instance).post(path + '/annotations').set(learnerHeaders).send({ kind: 'HIGHLIGHT', quote: 'at noon' }).expect(201);
  assert.equal((await request(instance).get(path + '/annotations').set(ownerHeaders).expect(200)).body.data.length, 0);
  await request(instance).post(path + '/report').set(learnerHeaders).send({ reason: 'Test moderation report' }).expect(200);
  await request(instance).post(path + '/clone').set(learnerHeaders).expect(201);
  const writing = '/api/study/lessons/english-first-steps-4';
  const draft = await request(instance).post(writing + '/submission').set(learnerHeaders).send({ text: 'I wake up at eight.', submit: false }).expect(201);
  const body = { attemptId: draft.body.data.id, text: 'I wake up early and walk to class.', submit: true };
  await request(instance).post(writing + '/submission').set(ownerHeaders).send(body).expect(409);
  await request(instance).post(writing + '/submission').set(learnerHeaders).send(body).expect(200);
  await request(instance).post(writing + '/submission').set(learnerHeaders).send(body).expect(409);
  const progress = await request(instance).get('/api/account/progress').set(learnerHeaders).expect(200);
  assert.equal(progress.body.data.attempts, 2);
  assert.equal(progress.body.data.streak, 1);
  assert.equal(progress.body.data.skills.find((item: { skill: string }) => item.skill === 'READING').average, 100);
});

test('quiz deadlines, Leitner review, audio privacy and rotating refresh integrate with persisted accounts', async () => {
  const codes = new Map<string, string>();
  const instance = createApp(db, testConfig(), async (email, code) => { codes.set(email, code); });
  const password = 'Practice@12345';
  const email = 'review-owner@example.test';
  const owner = (await request(instance).post('/api/auth/register').send({ name: 'Review Tester', email, password }).expect(201)).body.data;
  const other = (await request(instance).post('/api/auth/register').send({
    name: 'Card Reader', email: 'review-reader@example.test', password, supportsRefresh: true,
  }).expect(201)).body.data;
  const lifetime = (token: string) => {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return payload.exp - payload.iat;
  };
  assert.equal(lifetime(owner.token), 7 * 86_400);
  assert.equal(lifetime(other.token), 15 * 60);
  const ownerHeaders = { Authorization: `Bearer ${owner.token}` };
  const otherHeaders = { Authorization: `Bearer ${other.token}` };
  const refresh = (refreshToken: string) => request(instance).post('/api/auth/refresh').send({ refreshToken });
  const [one, two] = await Promise.all([refresh(owner.refreshToken), refresh(owner.refreshToken)]);
  assert.deepEqual([one.status, two.status].sort(), [200, 401]);
  const replacement = (one.status === 200 ? one : two).body.data.refreshToken;
  await request(instance).put('/api/account/onboarding').set(ownerHeaders).send({ nativeLang: 'vi', level: 'B2',
    preferences: { goal: 'work', ageGroup: '18-24', dailyMinutes: 15, referral: 'school' } }).expect(200);
  const updated = await request(instance).patch('/api/account/profile').set(ownerHeaders).send({ name: 'Review Update', appearance: 'dark' }).expect(200);
  assert.equal(updated.body.data.preferences.dailyMinutes, 15);
  assert.equal(updated.body.data.preferences.appearance, 'dark');

  const createdQuiz = (await request(instance).post('/api/study/quizzes').set(ownerHeaders).send({ mode: 'QUIZ' }).expect(201)).body.data;
  assert.equal(createdQuiz.questions.length, 5);
  assert.equal(createdQuiz.questions[0].answer, undefined);
  const submit = (quizId: string, answers: number[]) => request(instance).post(`/api/study/quizzes/${quizId}/submit`).set(ownerHeaders).send({ answers });
  await submit(createdQuiz.id, [-1, -1, -1, -1, -1]).expect(200);
  const exam = (await request(instance).post('/api/study/quizzes').set(ownerHeaders).send({ mode: 'EXAM' }).expect(201)).body.data;
  assert.equal(exam.questions.length, 20);
  await db.quizAttempt.update({ where: { id: exam.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await submit(exam.id, Array(20).fill(-1)).expect(409);

  const deck = (await request(instance).post('/api/learn/decks').set(ownerHeaders).send({ title: 'Vocabulary practice' }).expect(201)).body.data;
  const deckPath = `/api/learn/decks/${deck.id}`;
  await request(instance).post(deckPath + '/cards').set(ownerHeaders).send({ cards: [{ front: 'garden', back: 'khu vườn' }] }).expect(201);
  await request(instance).get(deckPath).set(otherHeaders).expect(404);
  await request(instance).patch(deckPath).set(ownerHeaders).send({ isPublic: true }).expect(200);
  const open = await request(instance).get(deckPath).set(otherHeaders).expect(200);
  const cardPath = `/api/learn/cards/${open.body.data.cards[0].id}/review`;
  await request(instance).post(cardPath).set(otherHeaders).send({ answer: 'good' }).expect(404);
  const review = await request(instance).post(cardPath).set(ownerHeaders).send({ answer: 'good' }).expect(200);
  assert.equal(review.body.data.box, 2);
  await request(instance).post(cardPath).set(ownerHeaders).send({ answer: 'good' }).expect(409);
  await request(instance).post(deckPath + '/clone').set(otherHeaders).expect(201);

  const media = (await request(instance).post('/api/study/audio').set(ownerHeaders)
    .send({ mimeType: 'audio/wav', data: Buffer.from('RIFF0000WAVEfmt ').toString('base64') }).expect(201)).body.data;
  await request(instance).get(`/api/study/audio/${media.id}`).set(otherHeaders).expect(404);
  await request(instance).get(`/api/study/audio/${media.id}`).set(ownerHeaders).expect(200);
  await request(instance).post('/api/study/lessons/english-first-steps-3/submission').set(ownerHeaders)
    .send({ audioId: media.id, submit: true }).expect(201);

  await request(instance).post('/api/auth/forgot-password').send({ email }).expect(200);
  await request(instance).post('/api/auth/reset-password').send({ email, code: codes.get(email), password: 'Updated@12345' }).expect(200);
  await refresh(replacement).expect(401);
  const newToken = (await request(instance).post('/api/auth/login').send({ email, password: 'Updated@12345' }).expect(200)).body.data.token;
  await request(instance).delete('/api/account/profile').set('Authorization', `Bearer ${newToken}`)
    .send({ password: 'Updated@12345', confirmation: 'XÓA' }).expect(200);
  assert.equal(await db.studyMedia.count({ where: { ownerId: owner.user.id } }), 0);
  assert.equal(await db.studyDay.count({ where: { userId: owner.user.id } }), 0);
});

test('OAuth handoff requires the app proof and the browser ticket and can be redeemed once', async () => {
  const instance = createApp(db, testConfig(), async () => {});
  const user = await db.user.create({ data: { email: 'oauth-handoff@example.test', name: 'OAuth Test', passwordHash: 'unused' } });
  const id = randomBytes(32).toString('base64url');
  const proof = randomBytes(32).toString('base64url');
  const ticket = randomBytes(32).toString('base64url');
  const digest = (value: string) => createHash('sha256').update(value).digest('hex');
  await db.socialFlow.create({ data: { id, provider: 'google', platform: 'web', proofHash: digest(proof),
    ticketHash: digest(ticket), userId: user.id, version: user.tokenVersion, expiresAt: new Date(Date.now() + 60_000) } });
  const complete = (appProof: string, browserTicket: string) => request(instance).post('/api/auth/social/complete')
    .send({ id, proof: appProof, ticket: browserTicket });
  await complete(proof, proof).expect(404);
  await complete(ticket, ticket).expect(404);
  const result = await complete(proof, ticket).expect(200);
  assert.equal(result.body.data.user.id, user.id);
  assert.equal(result.body.data.user.passwordHash, undefined);
  await complete(proof, ticket).expect(404);
});

test('SAT section saves answers, grades both modules and restricts attempt access', async () => {
  const catalog = (await request(app).get('/api/exams').expect(200)).body.data;
  assert.equal(catalog.filter((item: { paper?: object }) => item.paper).length, 8);
  const signUp = async (email: string) => {
    const response = await request(app).post('/api/auth/register')
      .send({name:'Exam tester', email, password:'ExamTester123!'}).expect(201);
    return 'Bearer ' + response.body.data.token;
  };
  const owner = await signUp('sat-owner@example.test');
  const otherAccount = await signUp('sat-other@example.test');
  const begin = '/api/exams/sat-paper-9/start';
  await request(app).post(begin).expect(401);
  const attempt = (await request(app).post(begin).set('Authorization', owner).expect(200)).body.data;
  assert.equal(attempt.questions.length, 66);
  assert.ok(attempt.questions.every((question: { correct?: number }) => question.correct === undefined));
  const path = '/api/exams/attempts/' + attempt.id;
  await request(app).get(path).set('Authorization', otherAccount).expect(404);
  const saved = (await request(app).put(path + '/answers').set('Authorization', owner)
    .send({question:0, choice:0, revision:attempt.revision}).expect(200)).body.data;
  await request(app).put(path + '/answers').set('Authorization', owner)
    .send({question:33, choice:1, revision:saved.revision}).expect(200);
  const resumed = (await request(app).post(begin).set('Authorization', owner).expect(200)).body.data;
  assert.deepEqual([resumed.id, resumed.answers[0], resumed.answers[33]], [attempt.id, 0, 1]);
  const result = (await request(app).post(path + '/submit').set('Authorization', owner).expect(200)).body.data;
  assert.equal(result.correct, 2);
  assert.equal(result.questions[33].correct, 1);
  const history = (await request(app).get('/api/exams/history').set('Authorization', owner).expect(200)).body.data;
  assert.equal(history[0].correct, 2);
});

test('mobile resource contracts use the same users, word index, flashcards, learning sets and writing history as the app', async () => {
  const api = request(createApp(db, testConfig(), async () => {}));
  const session = async (email:string) => (await api.post('/api/auth/register').send({fullName:'Mobile learner',email,password:'Learning@12345'}).expect(201)).body.data;
  const mine=await session('contract-owner@example.test'), other=await session('contract-learner@example.test');
  const auth={Authorization:'Bearer '+mine.token}, guest={Authorization:'Bearer '+other.token};
  assert.equal((await api.get('/api/users/me').set(auth).expect(200)).body.data.fullName,'Mobile learner');
  await api.put('/api/users/me').set(auth).send({fullName:'Updated learner',levelId:3}).expect(200);
  assert.equal((await api.get('/api/auth/me').set(auth)).body.data.level,'B1');
  const allWords=(await api.get('/api/words?limit=1').set(auth).expect(200)).body;
  assert.ok(allWords.metadata.total>=147306);
  const exact=(await api.get('/api/words?search=photosynthesis').set(auth).expect(200)).body.data[0];
  assert.equal(exact.word,'photosynthesis'); assert.ok(exact.definition.length>10);
  assert.equal((await api.get('/api/words/photosynthesis').set(auth)).body.definition,exact.definition);
  assert.equal((await api.get('/api/words?languageCode=ja').set(auth)).body.metadata.total,0);
  assert.equal((await api.get('/api/learn/dictionary?page=2&q=nonexistentzzzz').set(auth)).body.data.total,0);
  const deck=(await api.post('/api/flashcard-decks').set(auth).send({title:'Biology',description:'Things that grow'}).expect(201)).body.data;
  const card=(await api.post('/api/flashcards').set(auth).send({deckId:deck.id,word:'leaf',translation:'lá cây'}).expect(201)).body.data;
  await api.get('/api/flashcard-decks/explore/'+deck.id).expect(404);
  await api.post('/api/flashcard-progress/answer').set(guest).send({cardId:card.id,quality:'good'}).expect(404);
  await api.post('/api/flashcard-progress/answer').set(auth).send({cardId:card.id,quality:'good'}).expect(200);
  assert.equal((await api.get('/api/flashcard-progress/deck/'+deck.id).set(auth)).body.data.length,0);
  await api.put('/api/flashcard-decks/'+deck.id+'/public').set(auth).send({isPublic:true}).expect(200);
  assert.equal((await api.get('/api/flashcard-decks/explore/'+deck.id)).body.data.flashcards[0].word,'leaf');
  const categories=(await api.get('/api/content-categories')).body.data;
  const input={title:'A reading workshop',categoryId:categories[0].id,levelId:2,contentType:'READING',detail:{plainText:'The sun rises in the east.'}};
  const item=(await api.post('/api/content-items').set(auth).send(input).expect(201)).body.data;
  await api.get('/api/content-items/'+item.id).set(guest).expect(404);
  await api.patch('/api/content-items/'+item.id+'/publish').set(auth).send({}).expect(200);
  const practice=(await api.get('/api/study/lessons/'+item.id).set(guest)).body.data;
  assert.equal(practice.body,input.detail.plainText); assert.equal(item.lessonId,practice.id);
  const base='/api/reading-passages/'+item.id;
  const payload={title:'Sunrise',questions:[{questionType:'MCQ',questionText:'Where does it rise?',options:[{optionText:'East',isCorrect:true},{optionText:'West',isCorrect:false}]}]};
  await api.post(base+'/assessments').set(guest).send(payload).expect(404);
  const set=(await api.post(base+'/assessments').set(auth).send(payload).expect(201)).body.data;
  const run=(await api.post(base+'/attempts').set(guest).send({assessmentId:set.id}).expect(201)).body.data;
  assert.equal(run.questions[0].options[0].isCorrect,undefined);
  await api.get('/api/reading-attempts/'+run.id).set(auth).expect(404);
  const answer={answers:[{questionId:1,selectedOptionId:1}]};
  const scored=(await api.patch('/api/reading-attempts/'+run.id+'/submit').set(guest).send(answer).expect(200)).body.data;
  assert.equal(scored.result.score,100);
  await api.patch('/api/reading-attempts/'+run.id+'/submit').set(guest).send({answers:[]}).expect(200);
  assert.equal((await api.get('/api/study/lessons/'+practice.id+'/attempts').set(guest)).body.data.length,1);
  const writing=(await api.get('/api/content-items/explore?contentType=WRITING')).body.data.items[0];
  const draft=(await api.post('/api/writing-prompts/'+writing.id+'/submissions').set(auth).send({originalText:'My first draft.'}).expect(201)).body.data;
  const path='/api/writing-submissions/'+draft.id;
  await api.patch(path).set(guest).send({originalText:'Other'}).expect(404);
  await api.patch(path).set(auth).send({originalText:'My final draft.'}).expect(200);
  await api.post(path+'/submit').set(auth).send({}).expect(200);
  await api.patch(path).set(auth).send({originalText:'Late edit'}).expect(409);
  const copy=(await api.post(path+'/reopen-as-draft').set(auth).send({}).expect(201)).body.data;
  assert.equal(copy.status,'DRAFT');assert.equal(copy.originalText,'My final draft.');
  await api.post(path+'/ai/evaluate').set(auth).send({}).expect(503);
});

test('all 309 mobile method/path pairs resolve to an Express handler', () => {
  // Match the actual mounted router, including nested mounts and array paths.
  type Layer = {matchers?: ((url:string)=>false|{path:string})[]; route?:{methods:Record<string,boolean>}; handle?:{stack?:Layer[]}};
  function matches(stack:Layer[],method:string,path:string):boolean {
    return stack.some(layer=>{
      const hit=layer.matchers?.map(match=>match(path)).find(value=>value!==false);
      if(!hit)return false;
      if(layer.route)return Boolean(layer.route.methods[method]);
      return !!layer.handle?.stack && matches(layer.handle.stack,method,path.slice(hit.path.length)||'/');
    });
  }
  const missing=routeContract.filter(line=>{
    const [verb,path]=line.split(' ');
    return !matches(app.router.stack as unknown as Layer[],verb.toLowerCase(),path.replaceAll(':id','12345'));
  });
  assert.deepEqual(missing,[]);
});

test('media, authoring and vocabulary resources enforce ownership and preserve graded snapshots',async()=>{
  const api=request(createApp(db,testConfig(),async()=>{}));
  const session=async(email:string)=>({Authorization:'Bearer '+(await api.post('/api/auth/register').send({fullName:'Practice Student',email,password:'English@123456'}).expect(201)).body.data.token});
  const me=await session('workshop-owner@example.test'),other=await session('workshop-guest@example.test');
  const categories=(await api.get('/api/content-categories')).body.data;
  const create=async(contentType:string,detail:object)=>(await api.post('/api/content-items').set(me).send({title:'Practice workshop',contentType,detail,status:'PUBLISHED',isPublic:true,levelId:1,categoryId:categories[0].id}).expect(201)).body.data;
  const r=await create('READING',{plainText:'A leaf grows.'});
  const w=(await api.post('/api/reading-passages/'+r.id+'/saved-words').set(other).send({surfaceForm:'Leaf',meaningNative:'lá'}).expect(201)).body.data;
  assert.equal(w.surfaceForm,'leaf');
  await api.patch('/api/reading-saved-words/'+w.id).set(me).send({note:'test'}).expect(404);
  const wav=Buffer.alloc(128);wav.write('RIFF',0);wav.write('WAVE',8);
  const file=(await api.post('/api/content-items/upload-audio').set(me).attach('file',wav,{filename:'speech.wav',contentType:'audio/wav'}).expect(201)).body.data;
  const l=await create('LISTENING',{transcript:'I can hear birds.',audioUrl:file.audioUrl});
  await api.get(file.audioUrl).expect(200);
  const notes='/api/listening-audios/'+l.id+'/annotations';
  const ann=(await api.post(notes).set(other).send({type:'HIGHLIGHT',rangeStart:0,rangeEnd:5}).expect(201)).body.data;
  assert.equal(ann.quote,'I can');
  await api.post('/api/listening-annotations/'+ann.id+'/pin').set(other).expect(200);
  await api.delete('/api/listening-annotations/'+ann.id).set(me).expect(404);
  const sp=await create('SPEAKING',{promptText:'Introduce yourself.'}), bp='/api/speaking-prompts/'+sp.id;
  const assess=(await api.post(bp+'/assessments').set(me).send({title:'Discussion',isActive:true}).expect(201)).body.data;
  const q=(await api.post('/api/speaking-assessments/'+assess.id+'/questions').set(me).send({questionText:'Where do you live?',sampleAnswer:'In a city.'}).expect(201)).body.data;
  await api.get('/api/speaking-questions/'+q.id).set(other).expect(200);
  await api.get('/api/speaking-assessments/'+assess.id+'/answer-key').set(other).expect(404);
  await api.delete('/api/speaking-questions/'+q.id).set(other).expect(404);
  const a=(await api.post(bp+'/attempts').set(me).send({}).expect(201)).body.data;
  const clips='/api/speaking-attempts/'+a.id+'/recordings';
  const upload=(await api.post(clips+'/upload-url').set(me).send({fileName:'hello.wav',mimeType:'audio/wav'}).expect(201)).body.data;
  await api.put(upload.uploadUrl).set('Content-Type','audio/wav').send(wav).expect(200);
  await api.put(upload.uploadUrl).set('Content-Type','audio/wav').send(wav).expect(409);
  const clip='/api/speaking-recordings/'+upload.id;
  await api.post(clip+'/upload-complete').set(me).send({}).expect(200);
  await api.get(clip+'/signed-url').set(other).expect(404);
  const playback=(await api.get(clip+'/signed-url').set(me).expect(200)).body.data.signedUrl;
  await api.get(playback.split('?')[0]).expect(403);
  const actual=await api.get(playback).buffer().expect(200);
  assert.deepEqual(actual.body,wav);
  await api.post('/api/speaking-attempts/'+a.id+'/submit').set(me).send({}).expect(200);
  await api.delete(clip).set(me).expect(409);
});
