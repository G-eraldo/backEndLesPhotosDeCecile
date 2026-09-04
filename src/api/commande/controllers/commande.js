'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::commande.commande', ({ strapi }) => ({
  async getPrivatePhoto(ctx) {
    const { documentId } = ctx.params;
    if (!documentId) return ctx.badRequest('Identifiant de commande manquant.');

    const url = await strapi.service('api::commande.commande').getPrivatePhotoUrl(documentId);
    if (!url) return ctx.notFound('Photo privée introuvable.');

    ctx.body = { url };
  },
}));
