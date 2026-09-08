'use strict';

const { randomUUID } = require('node:crypto');

const HOLD_MS = 30 * 60 * 1000;
const LEASE_MS = 2 * 60 * 1000;
const fields = ['reference', 'details', 'statut', 'mollie_payment_id'];
const uidFor = (type) => `api::${type}.${type}`;
const fail = (status, message) => { const error = new Error(message); error.status = status; throw error; };
const overlaps = (first, second) => Date.parse(first.start) < Date.parse(second.end) && Date.parse(first.end) > Date.parse(second.start);

// A single transaction-scoped PostgreSQL lock also serializes overlapping slots
// with different start times. Business data is read/written by Document Service.
const createCoordinator = (strapi, { now = Date.now, uuid = randomUUID } = {}) => {
  const locked = (work) => {
    if (strapi.db.connection.client.config.client !== 'pg') fail(503, 'Payment coordination requires PostgreSQL.');
    return strapi.db.transaction(async ({ trx }) => {
      await trx.raw('SELECT pg_advisory_xact_lock(?, ?)', [17011992, 1]);
      return work();
    });
  };
  const conflictingReservation = async (slot, reference) => {
    const documents = strapi.documents(uidFor('reservation'));
    for (let start = 0; ; start += 100) {
      const rows = await documents.findMany({ fields, filters: { statut: { $in: ['en_attente', 'paye'] } }, sort: ['id:asc'], start, limit: 100 });
      for (const row of rows) {
        if (row.reference === reference) continue;
        const hold = row.details?.reservationHold;
        // Legacy paid reservations remain covered by the Calendar check.
        if (!hold || (row.statut !== 'paye' && Date.parse(hold.expiresAt) <= now())) continue;
        if (overlaps(slot, hold)) return true;
      }
      if (rows.length < 100) return false;
    }
  };
  return {
    async execute(input) {
      return locked(async () => {
        const documents = strapi.documents(uidFor(input.type));
        if (input.operation === 'hold') {
          if (await conflictingReservation(input.slot, input.data.reference)) fail(409, 'Ce créneau vient d’être réservé.');
          return { data: await documents.create({ data: {
            ...input.data,
            details: { ...input.data.details, reservationHold: { ...input.slot, expiresAt: new Date(now() + HOLD_MS).toISOString() } },
          } }) };
        }
        const record = await documents.findOne({ documentId: input.documentId, fields: [...fields, input.type === 'commande' ? 'montant_total' : 'montant_acompte', ...(input.type === 'commande' ? ['photo_privee'] : [])] });
        if (!record) fail(404, 'Paiement introuvable.');
        if (input.operation === 'claim') {
          const finalisation = record.details?.finalisation;
          if (finalisation?.statut === 'remboursement_demande') return { refunded: true };
          if (record.statut === 'paye' && (!finalisation || (finalisation.statut === 'terminee' && record.details?.emailEnvoye !== false && record.details?.notificationCecileEnvoyee !== false))) return { completed: true };
          if (finalisation?.statut === 'en_cours' && Date.parse(finalisation.demarreeLe) > now() - LEASE_MS) return { processing: true };
          const slotConflict = input.type === 'reservation' && record.details?.reservationHold && await conflictingReservation(record.details.reservationHold, record.reference);
          const attemptId = uuid();
          const data = await documents.update({ documentId: record.documentId, data: {
            statut: 'paye',
            details: { ...record.details, paiementConfirmeLe: record.details?.paiementConfirmeLe || new Date(now()).toISOString(), finalisation: { statut: 'en_cours', tentativeId: attemptId, demarreeLe: new Date(now()).toISOString() } },
          } });
          return { data, attemptId, slotConflict: Boolean(slotConflict) };
        }
        if (input.operation === 'checkpoint') {
          if (record.details?.finalisation?.tentativeId !== input.attemptId) fail(409, 'La tentative de finalisation a expiré.');
          return { data: await documents.update({ documentId: record.documentId, data: {
            details: { ...record.details, ...input.patch.details, finalisation: { ...record.details.finalisation, demarreeLe: new Date(now()).toISOString() } },
          } }) };
        }
        if (input.operation === 'finish') {
          if (record.details?.finalisation?.tentativeId !== input.attemptId) fail(409, 'La tentative de finalisation a expiré.');
          const finalisation = { ...record.details.finalisation, statut: input.state, termineeLe: new Date(now()).toISOString() };
          return { data: await documents.update({ documentId: record.documentId, data: { ...input.patch, details: { ...record.details, ...input.patch?.details, finalisation } } }) };
        }
        // A delayed canceled/expired webhook must never downgrade a paid record.
        const data = { ...input.patch };
        if (record.statut === 'paye' && data.statut && data.statut !== 'paye') return { data: record };
        return { data: await documents.update({ documentId: record.documentId, data }) };
      });
    },
  };
};

module.exports = { createCoordinator, overlaps, HOLD_MS, LEASE_MS };
