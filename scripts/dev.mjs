import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!existsSync(resolve(root, 'backend/.env')) || !existsSync(resolve(root, 'mobile/node_modules'))) {
  console.error('Chạy npm run setup trước.'); process.exit(1);
}
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return; stopping = true;
  for (const child of children) {
    if (child.exitCode !== null || !child.pid) continue;
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 800);
}
function run(folder, args) {
  const child = spawn(process.execPath, args, { cwd: resolve(root, folder), stdio: 'inherit', env: process.env, windowsHide: true });
  children.push(child);
  child.on('error', err => { console.error(err.message); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code || 0); });
  return child;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop());
run('backend', ['node_modules/tsx/dist/cli.mjs', 'scripts/local.ts']);
console.log('Đang đợi API khởi động...');
let ready = false;
for (let i = 0; i < 90 && !stopping; i++) {
  try {
    const response = await fetch('http://localhost:4000/api/health', { signal: AbortSignal.timeout(1500) });
    const body = await response.json();
    if (body.data?.app === 'AstraLingo') { ready = true; break; }
  } catch {}
  await new Promise(resolve => setTimeout(resolve, 1000));
}
if (!ready) { console.error('API chưa sẵn sàng; xem lỗi ở trên.'); stop(1); }
else {
  console.log('\nWeb: http://localhost:8081\nExpo: quét mã QR trên điện thoại cùng Wi-Fi.\n');
  for (const [name, list] of Object.entries(networkInterfaces())) for (const addr of list ?? []) {
    if (addr.family === 'IPv4' && !addr.internal) console.log(`Địa chỉ ${name}: http://${addr.address}:4000/api`);
  }
  run('mobile', ['node_modules/expo/bin/cli', 'start', '--lan', '--port', '8081']);
}
