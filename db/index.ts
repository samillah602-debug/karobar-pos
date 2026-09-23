import 'server-only';
import { Pool } from 'pg';

let pool: Pool | undefined;

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!connectionString) throw new Error('Database is not configured');
    pool = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 15_000,
      allowExitOnIdle: true,
    });
    pool.on('error', () => console.error('A database connection was interrupted'));
  }
  return pool;
}
