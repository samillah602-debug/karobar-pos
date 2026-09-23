import type { StoreQuery } from '../pos/storage-core';

export async function takeLoginAttempt(query: StoreQuery, key: string) {
  const result = await query(`
    INSERT INTO login_attempts (key, attempts, expires_at)
    VALUES ($1, 1, now() + interval '10 minutes')
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE WHEN login_attempts.expires_at <= now() THEN 1 ELSE login_attempts.attempts + 1 END,
      expires_at = CASE WHEN login_attempts.expires_at <= now() THEN now() + interval '10 minutes' ELSE login_attempts.expires_at END
    RETURNING attempts
  `, [key]);
  return Number(result.rows[0]?.attempts) <= 10;
}
