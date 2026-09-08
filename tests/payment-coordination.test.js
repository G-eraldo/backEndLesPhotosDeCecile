'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCoordinator, HOLD_MS, LEASE_MS } = require('../src/api/payment-operation/services/coordination');

const setup = () => {
  let currentTime = Date.parse('2030-01-01T00:00:00Z');
  const rows = [];
  let queue = Promise.resolve();
  const strapi = {
    db: {
      connection: { client: { config: { client: 'pg' } } },
      transaction(work) {
        const next = queue.then(() => work({ trx: { raw: async (sql, params) => { assert.match(sql, /pg_advisory_xact_lock/); assert.deepEqual(params, [17011992, 1]); } } }));
        queue = next.catch(() => {});
        return next;
      },
    },
    documents: () => ({
      findMany: async ({ start, limit, fields, filters }) => { assert.ok(fields.length); return structuredClone(rows.filter((r) => filters.statut.$in.includes(r.statut)).slice(start, start + limit)); },
      findOne: async ({ documentId }) => structuredClone(rows.find((r) => r.documentId === documentId)),
      create: async ({ data }) => { const row = { ...structuredClone(data), documentId: `doc${rows.length + 1}` }; rows.push(row); return structuredClone(row); },
      update: async ({ documentId, data }) => { const row = rows.find((r) => r.documentId === documentId); Object.assign(row, structuredClone(data)); return structuredClone(row); },
    }),
  };
  return { rows, strapi, coordinator: () => createCoordinator(strapi, { now: () => currentTime }), advance: (ms) => { currentTime += ms; } };
};
const hold = (reference) => ({ operation: 'hold', type: 'reservation', slot: { start: '2030-01-02T10:00:00Z', end: '2030-01-02T11:00:00Z' }, data: { reference, statut: 'en_attente', details: {}, montant_acompte: 30, mollie_payment_id: `tr_${reference}` } });

test('two workers cannot acquire overlapping reservation holds', async () => {
  const db = setup();
  const result = await Promise.allSettled([db.coordinator().execute(hold('a')), db.coordinator().execute(hold('b'))]);
  assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(result.find((r) => r.status === 'rejected').reason.status, 409);
  assert.equal(db.rows.length, 1);
});

test('expired holds are released, and late paid checkout detects its replacement', async () => {
  const db = setup();
  const first = await db.coordinator().execute(hold('a'));
  db.advance(HOLD_MS + 1);
  await db.coordinator().execute(hold('b'));
  const claim = await db.coordinator().execute({ operation: 'claim', type: 'reservation', documentId: first.data.documentId });
  assert.equal(claim.slotConflict, true);
});

test('a paid slot remains unavailable after hold expiry', async () => {
  const db = setup();
  const first = await db.coordinator().execute(hold('a'));
  await db.coordinator().execute({ operation: 'claim', type: 'reservation', documentId: first.data.documentId });
  db.advance(HOLD_MS + 1);
  await assert.rejects(db.coordinator().execute(hold('b')), { status: 409 });
});

test('atomic claim serializes workers; old attempt cannot commit after lease replacement', async () => {
  const db = setup();
  const first = await db.coordinator().execute(hold('a'));
  const input = { operation: 'claim', type: 'reservation', documentId: first.data.documentId };
  const claims = await Promise.all([db.coordinator().execute(input), db.coordinator().execute(input)]);
  assert.equal(claims.filter((r) => r.attemptId).length, 1);
  assert.equal(claims.filter((r) => r.processing).length, 1);
  const old = claims.find((r) => r.attemptId);
  db.advance(LEASE_MS + 1);
  const fresh = await db.coordinator().execute(input);
  await assert.rejects(db.coordinator().execute({ ...input, operation: 'finish', attemptId: old.attemptId, state: 'terminee', patch: {} }), { status: 409 });
  await db.coordinator().execute({ ...input, operation: 'finish', attemptId: fresh.attemptId, state: 'terminee', patch: { details: { emailEnvoye: true, notificationCecileEnvoyee: true } } });
  assert.equal((await db.coordinator().execute(input)).completed, true);
});

test('late terminal webhook cannot downgrade a paid record', async () => {
  const db = setup();
  const first = await db.coordinator().execute(hold('a'));
  const input = { type: 'reservation', documentId: first.data.documentId };
  await db.coordinator().execute({ ...input, operation: 'claim' });
  await db.coordinator().execute({ ...input, operation: 'update', patch: { statut: 'expire' } });
  assert.equal(db.rows[0].statut, 'paye');
});

test('SQLite cannot silently run production coordination without advisory locks', async () => {
  const db = setup();
  db.strapi.db.connection.client.config.client = 'sqlite3';
  await assert.rejects(db.coordinator().execute(hold('a')), { status: 503 });
});
