import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
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
