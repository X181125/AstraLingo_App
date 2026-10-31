import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(1).default(0),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGINS: z.string().default('http://localhost:8081,http://127.0.0.1:8081'),
  MAIL_MODE: z.enum(['console', 'smtp']).default('console'),
  MAIL_FROM: z.string().default('AstraLingo <no-reply@example.com>'),
  SMTP_HOST: z.string().optional(), SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(), SMTP_PASS: z.string().optional(),
});

export function readConfig() {
  const config = schema.parse(process.env);
  if (config.NODE_ENV === 'production' && config.MAIL_MODE !== 'smtp') {
    throw new Error('Production requires MAIL_MODE=smtp.');
  }
  if (config.JWT_SECRET.startsWith('replace-')) throw new Error('Generate a real JWT_SECRET; run npm run setup.');
  if (config.MAIL_MODE === 'smtp' && (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASS)) {
    throw new Error('SMTP_HOST, SMTP_USER and SMTP_PASS are required.');
  }
  return config;
}
export type Config = ReturnType<typeof readConfig>;
