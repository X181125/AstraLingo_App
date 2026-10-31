import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const target = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(target)) {
  console.log('Root .env already exists; kept unchanged.');
} else {
  const template = readFileSync(new URL('../.env.docker.example', import.meta.url), 'utf8');
  writeFileSync(target, template.replace('GENERATE_RANDOM_PASSWORD', randomBytes(24).toString('hex')).replace('GENERATE_RANDOM_SECRET', randomBytes(48).toString('hex')), { mode: 0o600 });
  console.log('Created root .env with random secrets. Do not commit this file.');
}
console.log('Next: docker compose up --build -d');
