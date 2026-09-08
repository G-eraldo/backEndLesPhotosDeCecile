'use strict';

const { timingSafeEqual } = require('node:crypto');
const { createCoordinator } = require('../services/coordination');

module.exports = {
  async execute(ctx) {
    const secret = process.env.PAYMENT_OPERATIONS_SECRET;
    if (!secret || secret.length < 32) return ctx.throw(503, 'La coordination des paiements est indisponible.');
    const supplied = ctx.get('x-payment-operations-secret');
    const first = Buffer.from(secret);
    const second = Buffer.from(supplied || '');
    if (first.length !== second.length || !timingSafeEqual(first, second)) return ctx.unauthorized();
    const input = ctx.request.body;
    if (!input || !['reservation', 'commande'].includes(input.type) || !['hold', 'claim', 'checkpoint', 'finish', 'update'].includes(input.operation)) return ctx.badRequest('Opération invalide.');
    if (input.operation === 'hold') {
      if (input.type !== 'reservation' || !/^r[a-f0-9]{32}$/.test(input.data?.reference || '') || !input.data?.details || input.data.statut !== 'en_attente' || !Number.isFinite(input.data.montant_acompte) || input.data.montant_acompte <= 0 || !Number.isFinite(Date.parse(input.slot?.start)) || !Number.isFinite(Date.parse(input.slot?.end)) || Date.parse(input.slot.start) <= Date.now() || Date.parse(input.slot.end) <= Date.parse(input.slot.start)) return ctx.badRequest('Créneau invalide.');
    } else if (typeof input.documentId !== 'string' || !/^[a-zA-Z0-9]{1,100}$/.test(input.documentId)) return ctx.badRequest('Document invalide.');
    if (['checkpoint', 'finish', 'update'].includes(input.operation) && (!input.patch || typeof input.patch !== 'object' || Array.isArray(input.patch))) return ctx.badRequest('Modification invalide.');
    if (input.operation === 'checkpoint' && (typeof input.attemptId !== 'string' || !input.patch.details || Object.keys(input.patch.details).some((key) => !['emailEnvoye', 'notificationCecileEnvoyee'].includes(key)) || Object.values(input.patch.details).some((value) => typeof value !== 'boolean'))) return ctx.badRequest('Étape invalide.');
    if (input.operation === 'finish' && (typeof input.attemptId !== 'string' || !['terminee', 'erreur', 'remboursement_demande'].includes(input.state))) return ctx.badRequest('Finalisation invalide.');
    ctx.body = await createCoordinator(strapi).execute(input);
  },
};
