import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient, ApiError } from '../src/api-client';
test('HTML proxy errors retain status and successful HTML is rejected', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('<html>Too large</html>', { status: 413 });
    await assert.rejects(createApiClient('/api')('/auth/register'), e => e instanceof ApiError && e.status === 413);
    globalThis.fetch = async () => new Response('<html>SPA fallback</html>', { status: 200 });
    await assert.rejects(createApiClient('/api')('/courses'), e => e instanceof ApiError && e.status === 200);
  } finally { globalThis.fetch = original; }
});
test('release native refuses missing, relative or insecure API URLs', async () => {
  for (const url of ['', '/api', 'http://localhost:4000/api']) await assert.rejects(createApiClient(url, true)('/courses'), /API HTTPS/);
});
test('trailing slash, authorization and cancellation', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://example.test/api/courses');
      assert.equal((options?.headers as Record<string, string>).Authorization, 'Bearer test-token');
      return Response.json({ success: true, data: [1] });
    };
    assert.deepEqual(await createApiClient('https://example.test/api/')('/courses', { token: 'test-token' }), [1]);
    const controller = new AbortController(); controller.abort();
    globalThis.fetch = async (_url, options) => { assert.equal(options?.signal?.aborted, true); throw new DOMException('Aborted', 'AbortError'); };
    await assert.rejects(createApiClient('/api')('/courses', { signal: controller.signal }), { name: 'AbortError' });
  } finally { globalThis.fetch = original; }
});
