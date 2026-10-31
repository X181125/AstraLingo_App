import 'dotenv/config';
import { startPrismaDevServer } from '@prisma/dev';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { createMailer } from '../src/mail.js';
import { seed } from '../prisma/seed-data.js';

if (process.env.NODE_ENV === 'production') throw new Error('dev:local is only for local development.');
console.info('Khởi động PostgreSQL local (lần đầu có thể mất khoảng một phút)...');
const local = await startPrismaDevServer({ name: 'astralingo-nt118', port: 51213, databasePort: 51214, shadowDatabasePort: 51215, persistenceMode: 'stateful' });
process.env.DATABASE_URL = local.database.connectionString;
process.env.JWT_SECRET ||= randomBytes(48).toString('hex');
const db = new PrismaClient();
try {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { stdio: 'inherit', env: process.env, windowsHide: true });
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Migration failed (${code})`)));
  });
  await seed(db, true);
  const config = readConfig();
  const http = createApp(db, config, createMailer(config)).listen(config.PORT, '0.0.0.0', () => {
    console.info(`\nAstraLingo sẵn sàng: http://localhost:${config.PORT}/api/health`);
    console.info('Tài khoản mẫu: demo@astralingo.app / Astra@12345');
    console.info('Mã quên mật khẩu: xem backend/.local/mailbox.jsonl hoặc terminal này.\n');
  });
  let stopping = false;
  const stop = () => {
    if (stopping) return; stopping = true;
    http.close(async () => { await db.$disconnect(); await local.close(); process.exit(0); });
  };
  http.on('error', async error => { console.error(error.message); await db.$disconnect(); await local.close(); process.exit(1); });
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
} catch (error) { await db.$disconnect(); await local.close(); throw error; }
