import { PrismaClient } from '@prisma/client';
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { createMailer } from './mail.js';

const config = readConfig();
const db = new PrismaClient();
await db.$connect();
const server = createApp(db, config, createMailer(config)).listen(config.PORT, '0.0.0.0', () => {
  console.info(`AstraLingo API: http://localhost:${config.PORT}/api/health`);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => server.close(async () => { await db.$disconnect(); process.exit(0); }));
}
