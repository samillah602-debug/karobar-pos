import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { applyCommand } from '../lib/pos/commands';
import { blankPerson, initialState, stock, paid, due, refundDue, paymentStatus, type StoreState } from '../lib/pos/model';
import { receiptHTML } from '../lib/pos/exports';

function fixture() {
  let state = initialState();
  const run = (action: string, payload: unknown, id = randomUUID()) => {
    state = applyCommand(state, action, payload, id, '2026-09-23T10:00:00.000Z');
    return state;
  };
  run('product', { id: '', name: 'Knife', nameUr: '', namePa: '', sku: 'KN-1', barcode: '',
    category: 'Custom collection', price: 100, cost: 60, openingStock: 10, reorderLevel: 2, active: true });
  const productId = state.products[0].id;
  run('person', { kind: 'suppliers', person: { ...blankPerson(), name: 'Supplier' } });
  const supplierId = state.suppliers[0].id;
  const createOrder = (qty = 2, payment = 0) => run('createOrder', {
    type: 'city', customer: { ...blankPerson(), name: 'Customer', phone: '03000000000', address: 'Shop street', city: 'Lahore' },
    items: [{ productId, qty, price: 100 }], discount: 0, shipping: 0, charge: 0,
    payment, method: 'Cash', courierId: '', trackingNumber: '', expectedDate: '', instructions: '', notes: '', draft: false,
  });
  return { get state() { return state; }, run, productId, supplierId, createOrder };
}

test('order corrections preserve identity, update reservations and receipts, and reject stale or excessive edits', () => {
  const f = fixture();
  f.createOrder(2, 200);
  const original = structuredClone(f.state.orders[0]);
  const payload = { ...original, items: [{ ...original.items[0], qty: 4, name: 'Corrected description' }],
    expectedVersion: original.version || 0, reason: 'Customer requested four units' };
  f.run('editOrder', payload);
  const saved = f.state.orders[0];
  assert.equal(saved.id, original.id);
  assert.equal(saved.invoice, original.invoice);
  assert.equal(saved.total, 400);
  assert.equal(due(saved), 200);
  assert.equal(stock(f.state, f.productId).reserved, 4);
  assert.equal(stock(f.state, f.productId).available, 6);
  assert.match(receiptHTML(f.state, saved, 'en'), /Corrected description/);
  assert.ok(f.state.changes?.find(change => change.action === 'Order corrected')?.changes.some(change => change.field === 'items'));
  assert.throws(() => f.run('editOrder', payload), /record changed/);
  const before = structuredClone(f.state);
  assert.throws(() => f.run('editOrder', { ...saved, items: [{ ...saved.items[0], qty: 11 }],
    expectedVersion: saved.version, reason: 'Incorrect count' }), /already sold or reserved/);
  assert.deepEqual(f.state, before);
});

test('reducing an already paid order shows the exact refund and accepts only that refund', () => {
  const f = fixture();
  f.createOrder(2, 200);
  const order = f.state.orders[0];
  f.run('editOrder', { ...order, discount: 40, expectedVersion: order.version, reason: 'Agreed discount' });
  assert.equal(refundDue(f.state.orders[0]), 40);
  assert.equal(paymentStatus(f.state.orders[0]), 'Refund due');
  assert.throws(() => f.run('payment', { id: order.id, kind: 'order', amount: 41, method: 'Cash', note: '', refund: true }), /exceeds/);
  f.run('payment', { id: order.id, kind: 'order', amount: 40, method: 'Cash', note: 'Returned cash', refund: true });
  assert.equal(paid(f.state.orders[0]), 160);
  assert.equal(refundDue(f.state.orders[0]), 0);
  assert.equal(paymentStatus(f.state.orders[0]), 'Paid');
});

test('purchase edits cannot remove sold or reserved units and expose supplier credit', () => {
  const f = fixture();
  f.run('purchase', { supplierId: f.supplierId, items: [{ productId: f.productId, qty: 10, price: 60 }],
    discount: 0, shipping: 0, payment: 600, method: 'Cash', notes: '' });
  f.createOrder(12);
  let purchase = f.state.purchases[0];
  assert.throws(() => f.run('editPurchase', { ...purchase, items: [{ ...purchase.items[0], qty: 1 }],
    expectedVersion: purchase.version, reason: 'Correction' }), /already sold or reserved/);
  f.run('editPurchase', { ...purchase, items: [{ ...purchase.items[0], qty: 5 }],
    expectedVersion: purchase.version, reason: 'Supplier delivered five units' });
  purchase = f.state.purchases[0];
  assert.equal(stock(f.state, f.productId).available, 3);
  assert.equal(refundDue(purchase), 300);
  f.run('payment', { id: purchase.id, kind: 'purchase', refund: true, amount: 300, method: 'Cash', note: 'Supplier returned cash' });
  assert.equal(refundDue(f.state.purchases[0]), 0);
});

test('payment corrections and voids preserve previous values and reject an impossible net refund', () => {
  const f = fixture();
  f.createOrder(2, 200);
  let order = f.state.orders[0];
  const paymentId = order.payments[0].id;
  f.run('editPayment', { id: order.id, kind: 'order', paymentId, amount: 150, date: order.date,
    method: 'Bank transfer', note: 'Corrected receipt', reason: 'Entered 200 instead of 150', expectedVersion: order.version });
  order = f.state.orders[0];
  assert.equal(due(order), 50);
  const journal = f.state.changes?.find(change => change.action === 'Payment corrected');
  const beforePayments = journal?.changes.find(change => change.field === 'payments')?.before as { amount: number }[];
  assert.equal(beforePayments[0].amount, 200);
  f.run('editPayment', { id: order.id, kind: 'order', paymentId, amount: 150, date: order.date,
    method: 'Cash', note: '', reason: 'Duplicate entry', void: true, expectedVersion: order.version });
  assert.equal(f.state.orders[0].payments.length, 1);
  assert.equal(f.state.orders[0].payments[0].voided, true);
  assert.equal(due(f.state.orders[0]), 200);

  const g = fixture(); g.createOrder(2, 200);
  order = g.state.orders[0];
  g.run('orderStatus', { id: order.id, status: 'Cancelled', note: '' });
  g.run('payment', { id: order.id, kind: 'order', amount: 100, method: 'Cash', note: '', refund: true });
  order = g.state.orders[0];
  assert.throws(() => g.run('editPayment', { id: order.id, kind: 'order', paymentId: order.payments[0].id,
    amount: 50, date: order.date, method: 'Cash', note: '', reason: 'Correction', expectedVersion: order.version }), /related refund/);
});

test('stock corrections are idempotent, preserve reservations and reject a stale count', () => {
  const f = fixture(); f.createOrder(2);
  const id = randomUUID();
  const payload = { productId: f.productId, expectedOnHand: 10, onHand: 5, reason: 'Physical count' };
  f.run('adjustStock', payload, id); f.run('adjustStock', payload, id);
  assert.equal(stock(f.state, f.productId).onHand, 5);
  assert.equal(stock(f.state, f.productId).reserved, 2);
  assert.equal(stock(f.state, f.productId).available, 3);
  assert.equal(f.state.stockAdjustments?.length, 1);
  assert.throws(() => f.run('adjustStock', { ...payload, onHand: 4 }), /Stock changed/);
  assert.throws(() => f.run('adjustStock', { ...payload, expectedOnHand: 5, onHand: 1 }), /below reserved/);
});

test('received returns can be corrected only while the units remain available', () => {
  const f = fixture(); f.createOrder(2);
  const id = f.state.orders[0].id;
  f.run('orderStatus', { id, status: 'Out for Delivery', note: '' });
  f.run('orderStatus', { id, status: 'Returned', note: '' });
  f.run('returnStock', { id, items: [{ productId: f.productId, qty: 1 }], note: '' });
  let order = f.state.orders.find(order => order.id === id)!;
  f.run('editReturn', { id, items: [{ productId: f.productId, qty: 2 }], expectedVersion: order.version, reason: 'Both units inspected' });
  assert.equal(stock(f.state, f.productId).onHand, 10);
  f.createOrder(10);
  order = f.state.orders.find(order => order.id === id)!;
  assert.throws(() => f.run('editReturn', { id, items: [{ productId: f.productId, qty: 1 }],
    expectedVersion: order.version, reason: 'Wrong count' }), /already sold or reserved/);
});
