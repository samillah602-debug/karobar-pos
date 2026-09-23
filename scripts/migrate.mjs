import { readFile } from 'node:fs/promises';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) throw new Error('Set DATABASE_URL before running the migration.');
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(761419371)');
  await client.query(await readFile(new URL('../db/postgres.sql', import.meta.url), 'utf8'));
  await client.query('COMMIT');
  console.log('Database schema is ready. Existing records were preserved.');
} catch {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Migration failed. Check the database connection and permissions.');
  process.exitCode = 1;
} finally {
  await client.end();
}
