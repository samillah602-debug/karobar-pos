import { integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
export const workspace = pgTable('workspace', {
  id: text('id').primaryKey(),
  revision: integer('revision').notNull().default(0),
  payload: jsonb('payload').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
export const loginAttempts = pgTable('login_attempts', {
  key: text('key').primaryKey(),
  attempts: integer('attempts').notNull().default(1),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
