import { randomBytes } from 'node:crypto';
import { chmod, readFile, writeFile } from 'node:fs/promises';

const target = new URL('../.env.local', import.meta.url);
let existing = '';
try { existing = await readFile(target, 'utf8'); } catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (/^POS_(ACCESS_PASSWORD|SESSION_SECRET)=\S+/m.test(existing)) {
  throw new Error('Access credentials already exist. They were not replaced.');
}
existing = existing.replace(/^POS_(ACCESS_PASSWORD|SESSION_SECRET)=.*\r?\n?/gm, '');
await writeFile(target, `${existing.trimEnd()}\nPOS_ACCESS_PASSWORD=${randomBytes(24).toString('base64url')}\nPOS_SESSION_SECRET=${randomBytes(48).toString('base64url')}\n`, { mode: 0o600 });
await chmod(target, 0o600);
console.log('Access credentials saved privately to .env.local. Add them to Vercel environment settings and keep the password in your password manager.');
