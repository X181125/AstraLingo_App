import { appendFile, mkdir } from 'node:fs/promises';
import nodemailer from 'nodemailer';
import type { Config } from './config.js';

export type SendReset = (email: string, code: string) => Promise<void>;
export function createMailer(config: Config): SendReset {
  const smtp = config.MAIL_MODE === 'smtp' ? nodemailer.createTransport({
    host: config.SMTP_HOST, port: config.SMTP_PORT, secure: config.SMTP_PORT === 465,
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
    connectionTimeout: 10_000, socketTimeout: 15_000,
  }) : null;
  return async (email, code) => {
    if (smtp) {
      await smtp.sendMail({ from: config.MAIL_FROM, to: email,
        subject: 'Mã đặt lại mật khẩu AstraLingo',
        text: `Mã xác nhận của bạn: ${code}\nMã có hiệu lực trong 10 phút và chỉ dùng một lần. Nếu bạn không yêu cầu, hãy bỏ qua email này.`,
      });
    } else {
      await mkdir('.local', { recursive: true });
      await appendFile('.local/mailbox.jsonl', JSON.stringify({ at: new Date().toISOString(), to: email, code, expiresInMinutes: 10 }) + '\n', { mode: 0o600 });
      console.info(`[LOCAL MAIL] ${email} — mã: ${code} (10 phút). Hộp thư: backend/.local/mailbox.jsonl`);
    }
  };
}
