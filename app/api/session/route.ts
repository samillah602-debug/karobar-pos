import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getPool } from '@/db';
import { accessConfig, createSession, passwordMatches, SESSION_COOKIE, SESSION_SECONDS } from '@/lib/auth/session';
import { isConfigured, validOrigin } from '@/lib/auth/server';
import { takeLoginAttempt } from '@/lib/auth/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/' };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers });

export async function POST(request: Request) {
  if (!validOrigin(request)) return fail('Invalid request origin', 403);
  const config = accessConfig();
  if (!config || !isConfigured()) return fail('The store is not ready yet.', 503);
  try {
    const raw = await request.text();
    if (raw.length > 2048) return fail('Invalid sign-in request', 400);
    let body;
    try { body = JSON.parse(raw); } catch { return fail('Invalid sign-in request', 400); }
    if (typeof body?.password !== 'string' || body.password.length > 512) return fail('Invalid sign-in request', 400);
    // Vercel overwrites this header with the client address. Local development
    // shares a single limiter bucket. Raw addresses are never stored.
    const address = process.env.VERCEL === '1' ? request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown' : 'local';
    const key = createHmac('sha256', config.secret).update(address).digest('hex');
    const db = getPool();
    if (!await takeLoginAttempt((sql, args) => db.query(sql, args), key)) {
      return fail('Too many attempts. Please try again in 10 minutes.', 429);
    }
    if (!passwordMatches(body.password, config)) return fail('Incorrect password', 401);
    await db.query('DELETE FROM login_attempts WHERE key = $1', [key]);
    const response = NextResponse.json({ ok: true }, { headers });
    response.cookies.set(SESSION_COOKIE, await createSession(config), { ...cookieOptions, maxAge: SESSION_SECONDS });
    return response;
  } catch {
    console.error('Store sign-in is temporarily unavailable');
    return fail('Sign-in is temporarily unavailable. Please try again.', 503);
  }
}

export async function DELETE(request: Request) {
  if (!validOrigin(request)) return fail('Invalid request origin', 403);
  const response = NextResponse.json({ ok: true }, { headers });
  response.cookies.set(SESSION_COOKIE, '', { ...cookieOptions, maxAge: 0 });
  return response;
}
