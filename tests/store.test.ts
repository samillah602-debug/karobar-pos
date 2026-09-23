import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { createStoreBackend } from '../lib/pos/storage-core';
import { blankPerson, initialState, stock } from '../lib/pos/model';
import { takeLoginAttempt } from '../lib/auth/rate-limit';

test('PostgreSQL persists orders, rejects concurrent overselling, and restores cancelled reservations', async () => {
  const db = new PGlite();
  try {
    const migration = await readFile(new URL('../db/postgres.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    const query = (sql: string, args?: unknown[]) => db.query<Record<string, unknown>>(sql, args);
    const backend = createStoreBackend(query, initialState);
    const run = (action: string, payload: unknown, key = randomUUID()) => backend.writeCommand(action, payload, key);
    const start = await run('product', { id: '', name: 'Test item', nameUr: '', namePa: '', sku: 'ITEM-1', barcode: '123456', category: 'Kitchen', price: 200, cost: 100, openingStock: 1, reorderLevel: 1, active: true });
    const productId = start.state.products[0].id;
    const order = { type: 'city', customer: { ...blankPerson(), name: 'Test customer', phone: '03000000000', address: 'Test address' }, items: [{ productId, qty: 1, price: 200 }], discount: 20, shipping: 100, charge: 0, payment: 100, method: 'Cash', courierId: '', trackingNumber: '', expectedDate: '', instructions: '', notes: '', draft: false };
    const simultaneous = await Promise.allSettled([run('createOrder', order), run('createOrder', order)]);
    assert.equal(simultaneous.filter(x => x.status === 'fulfilled').length, 1);
    const saved = await backend.readStore();
    assert.equal(saved.state.orders.length, 1);
    assert.equal(saved.state.orders[0].total, 280);
    assert.equal(stock(saved.state, productId).available, 0);
    const cancelled = await run('orderStatus', { id: saved.state.orders[0].id, status: 'Cancelled', note: '' });
    assert.equal(stock(cancelled.state, productId).available, 1);

    const key = randomUUID();
    await Promise.all([run('createOrder', order, key), run('createOrder', order, key)]);
    const newProcess = createStoreBackend(query, initialState);
    const reopened = await newProcess.readStore();
    assert.equal(reopened.state.orders.length, 2);
    assert.equal(reopened.state.orders.filter(x => x.status === 'Confirmed').length, 1);
    assert.equal(stock(reopened.state, productId).available, 0);
    assert.equal(new Set(reopened.state.orders.map(x => x.id)).size, 2);
    await db.exec(migration);
    assert.equal((await newProcess.readStore()).state.orders.length, 2);
  } finally { await db.close(); }
});

test('login attempts are limited atomically across requests and reset after expiry', async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile(new URL('../db/postgres.sql', import.meta.url), 'utf8'));
    const query = (sql: string, args?: unknown[]) => db.query<Record<string, unknown>>(sql, args);
    const attempts = await Promise.all(Array.from({ length: 12 }, () => takeLoginAttempt(query, 'test-bucket')));
    assert.equal(attempts.filter(Boolean).length, 10);
    await db.query("UPDATE login_attempts SET expires_at = now() - interval '1 minute' WHERE key = $1", ['test-bucket']);
    assert.equal(await takeLoginAttempt(query, 'test-bucket'), true);
  } finally { await db.close(); }
});
