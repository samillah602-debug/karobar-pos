import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { createSession, passwordMatches, SESSION_SECONDS, verifySession } from '../lib/auth/session';
import { validOrigin } from '../lib/auth/origin';

test('signed sessions reject tampering, expiry, missing configuration, and credential rotation', async () => {
  const config = { password: randomBytes(24).toString('base64url'), secret: randomBytes(48).toString('base64url') };
  const token = await createSession(config);
  assert.equal(passwordMatches(config.password, config), true);
  assert.equal(passwordMatches('wrong', config), false);
  assert.equal(await verifySession(token, config), true);
  assert.equal(await verifySession(token.slice(0, -20) + 'changed', config), false);
  assert.equal(await verifySession(token, null), false);
  assert.equal(await verifySession(undefined, config), false);
  assert.equal(await verifySession(token, { ...config, password: randomBytes(24).toString('base64url') }), false);
  assert.equal(await verifySession(token, { ...config, secret: randomBytes(48).toString('base64url') }), false);
  const expired = await createSession(config, Math.floor(Date.now() / 1000) - SESSION_SECONDS - 60);
  assert.equal(await verifySession(expired, config), false);
});

test('origin checks use the public host while rejecting foreign and missing origins', () => {
  const make = (origin?: string) => new Request('http://localhost:4273/api/session', {
    headers: { host: '127.0.0.1:4273', ...(origin ? { origin } : {}) },
  });
  assert.equal(validOrigin(make('http://127.0.0.1:4273'), false), true);
  assert.equal(validOrigin(make('https://example.invalid'), false), false);
  assert.equal(validOrigin(make(), false), false);
  const hosted = new Request('http://internal/api/session', { headers: { host: 'example.vercel.app', origin: 'https://example.vercel.app' } });
  assert.equal(validOrigin(hosted, true), true);
  const insecure = new Request('http://internal/api/session', { headers: { host: 'example.vercel.app', origin: 'http://example.vercel.app' } });
  assert.equal(validOrigin(insecure, true), false);
});
