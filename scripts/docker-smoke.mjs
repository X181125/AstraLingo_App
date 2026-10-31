// Run against the Compose test stack. Creates a clearly named test account; does not delete data.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const base = process.env.TEST_BASE_URL || 'http://localhost:8080';
async function call(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${base}/api${path}`, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
  const data = await response.json();
  assert.ok(response.ok, `${path}: ${response.status} ${JSON.stringify(data)}`);
  return data.data;
}
async function ready() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try { await call('/health'); return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Stack is not ready after 60 seconds. Check docker compose logs.');
}
await ready();
for (const path of ['/login', '/register', '/forgot-password', '/home', '/course/english-first-steps']) {
  const r = await fetch(base + path);
  assert.equal(r.status, 200); assert.match(r.headers.get('content-type') || '', /text\/html/);
}
const email = `docker-smoke-${Date.now()}@example.test`, password = randomBytes(16).toString('hex');
const session = await call('/auth/register', { method: 'POST', body: { name: 'Docker smoke test', email, password } });
const filtered = await call('/courses?category=reading&level=A2'); assert.equal(filtered.total, 1);
await call('/courses/english-first-steps/enroll', { method: 'POST', token: session.token });
assert.equal((await call('/me/enrollments', { token: session.token })).length, 1);
if (process.argv.includes('--restart')) {
  console.log('Restarting only this Compose project to check persistence...');
  const restart = spawnSync('docker', ['compose', 'restart', 'postgres', 'backend', 'frontend'], { stdio: 'inherit', windowsHide: true });
  if (restart.error) throw restart.error;
  assert.equal(restart.status, 0);
  await ready();
  const loggedIn = await call('/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(loggedIn.user.id, session.user.id);
  assert.equal((await call('/me/enrollments', { token: loggedIn.token })).length, 1);
  assert.equal((await call('/auth/me', { token: session.token })).id, session.user.id);
  console.log('PASS: account, enrollment and JWT still work after PostgreSQL/API/proxy restart.');
}
console.log('PASS: SPA routes, API proxy, registration, filters and enrollment.');
console.log(`Test account retained for inspection: ${email}`);
