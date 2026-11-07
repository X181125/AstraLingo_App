import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const configure = createRequire(import.meta.url)('../app.config.js');
test('preview build rejects missing/local API and preserves the linked Expo project', () => {
  const profile = process.env.EAS_BUILD_PROFILE, address = process.env.EXPO_PUBLIC_API_URL;
  try {
    process.env.EAS_BUILD_PROFILE = 'preview';
    for (const value of ['', '/api', 'http://api.example.test/api', 'https://localhost/api', 'https://192.168.1.4/api']) {
      process.env.EXPO_PUBLIC_API_URL = value;
      assert.throws(() => configure({ config: {} }), /public HTTPS/);
    }
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test/api';
    const config = { extra: { eas: { projectId: 'linked-project' } }, android: { package: 'com.astralingo.app' } };
    assert.deepEqual(configure({ config }), config);
  } finally {
    if (profile === undefined) delete process.env.EAS_BUILD_PROFILE; else process.env.EAS_BUILD_PROFILE = profile;
    if (address === undefined) delete process.env.EXPO_PUBLIC_API_URL; else process.env.EXPO_PUBLIC_API_URL = address;
  }
});
