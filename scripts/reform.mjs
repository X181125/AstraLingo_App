import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const integrations = join(root, 'integrations');
const local = join(integrations, 'language-learning-reform');
const envFile = join(local, '.env.reform');
const project = 'astralingo-reform';
const [action = 'up', input] = process.argv.slice(2);
const sourceEntries = ['backend', 'mobile', 'compose.yaml', 'README.md', 'refresh_sat_papers.py'];
const required = ['backend/package.json', 'mobile/package.json', 'compose.yaml', 'backend/prisma/seed-preview.ts'];
const excluded = new Set(['.git', '.expo', '.local', '__pycache__', 'node_modules', 'dist', 'coverage', 'artifacts']);

function inside(candidate, directory) {
  const path = relative(directory, candidate);
  return path === '' || (path !== '..' && !path.startsWith('..' + sep) && !isAbsolute(path));
}

function include(path) {
  const name = basename(path).toLowerCase();
  return !lstatSync(path).isSymbolicLink() && !excluded.has(name) &&
    !name.startsWith('.env') && !/^(credentials|service-account).*\.json$/.test(name) &&
    !/\.(apk|aab|zip|dump|pem|key|p12|jks|keystore)$/.test(name);
}

function stage() {
  const sibling = resolve(root, '..', 'AstraLingo_App_Fork', 'integrations', 'language-learning');
  const source = resolve(input ?? (process.env.ASTRALINGO_REFORM_SOURCE || sibling));
  if (inside(source, local) || inside(local, source)) throw new Error('Chọn thư mục bản 18084 nằm ngoài bản sao tích hợp.');
  if (existsSync(local)) throw new Error('Bản sao cục bộ đã tồn tại tại ' + local);
  for (const file of required) {
    if (!existsSync(join(source, file)) || !statSync(join(source, file)).isFile()) {
      throw new Error('Thiếu ' + file + ' trong ' + source + '. Hãy chọn thư mục chứa bản 18084 hoàn chỉnh.');
    }
  }
  mkdirSync(integrations, { recursive: true });
  const staging = mkdtempSync(join(integrations, '.reform-stage-'));
  try {
    for (const entry of sourceEntries) {
      if (existsSync(join(source, entry))) cpSync(join(source, entry), join(staging, entry), {recursive:true, filter:include});
    }
    const env = ['PREVIEW_DB_PASSWORD', 'PREVIEW_JWT_SECRET']
      .map(name => name + '=' + randomBytes(32).toString('hex')).join('\n') + '\n';
    writeFileSync(join(staging, '.env.reform'), env, { mode: 0o600, flag:'wx' });
    renameSync(staging, local);
  } catch (error) {
    rmSync(staging, {recursive:true, force:true});
    throw error;
  }
  console.log('Đã chuẩn bị toàn bộ bản 18084 tại ' + local);
}

const actions = {
  up: ['up', '--build', '-d', '--wait'],
  status: ['ps', '-a'],
  stop: ['stop'],
  config: ['config', '--quiet'],
};

try {
  if (action === 'stage') {
    stage();
  } else {
    if (!Object.hasOwn(actions, action)) throw new Error('Lệnh hỗ trợ: stage, up, status, stop, config.');
    if (!existsSync(envFile)) throw new Error('Chạy npm run reform -- stage <thư mục bản 18084> trước.');
    const port = process.env.LANGUAGE_PREVIEW_PORT || '18086';
    if (!/^\d{1,5}$/.test(port) || +port < 1024 || +port > 65535) throw new Error('LANGUAGE_PREVIEW_PORT phải nằm trong khoảng 1024–65535.');
    const env = { ...process.env, LANGUAGE_PREVIEW_PORT:port };
    delete env.PREVIEW_DB_PASSWORD;
    delete env.PREVIEW_JWT_SECRET;
    const result = spawnSync('docker', ['compose', '--project-name', project, '--file', join(local, 'compose.yaml'), '--env-file', envFile, ...actions[action]], {
      cwd: local, env, stdio: 'inherit', windowsHide: true,
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
    if (process.exitCode === 0 && action === 'up') console.log('AstraLingo Reform: http://localhost:' + port);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
