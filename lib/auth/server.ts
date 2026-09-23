import 'server-only';
import { cookies } from 'next/headers';
import { accessConfig, SESSION_COOKIE, verifySession } from './session';
export { validOrigin } from './origin';

export function isConfigured() {
  return !!accessConfig() && !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}

export async function hasSession() {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value, accessConfig());
}
