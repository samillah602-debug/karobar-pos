import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'karobar_session';
export const SESSION_SECONDS = 12 * 60 * 60;
export type AccessConfig = { password: string; secret: string };

export function accessConfig(): AccessConfig | null {
  const password = process.env.POS_ACCESS_PASSWORD || '';
  const secret = process.env.POS_SESSION_SECRET || '';
  return password.length >= 24 && secret.length >= 32 ? { password, secret } : null;
}

export function passwordMatches(value: string, config: AccessConfig) {
  const digest = (text: string) => createHash('sha256').update(text).digest();
  return timingSafeEqual(digest(value), digest(config.password));
}

function sessionKey(config: AccessConfig) {
  // Changing either credential invalidates all existing sessions.
  return createHmac('sha256', config.secret).update(config.password).digest();
}

export async function createSession(config: AccessConfig, now = Math.floor(Date.now() / 1000)) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('owner')
    .setIssuer('karobar-pos')
    .setAudience('karobar-counter')
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_SECONDS)
    .sign(sessionKey(config));
}

export async function verifySession(token: string | undefined, config: AccessConfig | null) {
  if (!token || !config || token.length > 2048) return false;
  try {
    const { payload } = await jwtVerify(token, sessionKey(config), {
      algorithms: ['HS256'], issuer: 'karobar-pos', audience: 'karobar-counter',
    });
    return payload.sub === 'owner';
  } catch { return false; }
}
