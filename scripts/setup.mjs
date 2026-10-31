import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
for (const folder of ['backend', 'mobile']) {
  const cwd = resolve(root, folder);
  const envPath = resolve(cwd, '.env');
  if (!existsSync(envPath)) {
    let value = readFileSync(resolve(cwd, '.env.example'), 'utf8');
    if (folder === 'backend') value = value.replace('replace-with-at-least-32-random-characters', randomBytes(48).toString('hex'));
    writeFileSync(envPath, value, { mode: 0o600 });
    console.log(`Created ${folder}/.env`);
  }
  console.log(`Installing ${folder}...`);
  const result = spawnSync(npm, [existsSync(resolve(cwd, 'package-lock.json')) ? 'ci' : 'install', '--no-fund', '--no-audit'], { cwd, stdio: 'inherit', shell: process.platform === 'win32', windowsHide: true });
  if (result.status !== 0) process.exit(result.status || 1);
}
const generate = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'generate'], { cwd: resolve(root, 'backend'), stdio: 'inherit', windowsHide: true });
if (generate.status !== 0) process.exit(generate.status || 1);
console.log('\nSetup complete. Run: npm run dev\n');
