// Run after pnpm build. Uses temporary credentials and an unreachable fixture
// database; it never reads or writes production data.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { createSession } from '../lib/auth/session.ts';

const config = { password: randomBytes(24).toString('base64url'), secret: randomBytes(48).toString('base64url') };
const base = 'http://127.0.0.1:4273';
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '4273'], {
  env: { ...process.env, VERCEL: '', POS_ACCESS_PASSWORD: config.password, POS_SESSION_SECRET: config.secret, DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test', NEXT_TELEMETRY_DISABLED: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server did not become ready')), 20_000);
    server.stdout.on('data', value => { if (value.toString().includes('Ready')) { clearTimeout(timer); resolve(); } });
    server.once('exit', () => { clearTimeout(timer); reject(new Error('Server exited')); });
  });
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.ok((await page.text()).includes('Store password'));
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');

  for (const method of ['GET', 'POST']) {
    const response = await fetch(base + '/api/store', { method, headers: { Origin: base, 'Content-Type': 'application/json' }, body: method === 'POST' ? '{}' : undefined });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { error: 'Please sign in' });
  }
  const crossSite = await fetch(base + '/api/session', { method: 'POST', headers: { Origin: 'https://example.invalid', 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(crossSite.status, 403);

  const token = await createSession(config);
  const authorized = await fetch(base + '/api/store', { headers: { Cookie: 'karobar_session=' + token } });
  assert.equal(authorized.status, 503);
  assert.deepEqual(await authorized.json(), { error: 'The store is temporarily unavailable. Please try again.' });
  const validPost = await fetch(base + '/api/store', { method: 'POST', headers: { Origin: base, Cookie: 'karobar_session=' + token, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(validPost.status, 400);
  const logout = await fetch(base + '/api/session', { method: 'DELETE', headers: { Origin: base, Cookie: 'karobar_session=' + token } });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(logout.headers.get('set-cookie'), /Secure/i);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/i);
  console.log('Passed: production sign-in page, protected APIs, origin checks, authenticated routing, safe database errors, and secure logout.');
} finally {
  server.kill('SIGTERM');
}
