'use strict';

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }) {
    // Cette route appartient à l'API d'administration, jamais à l'API publique.
    // Les droits « Public » de Strapi ne peuvent donc pas donner accès aux photos R2.
    strapi.admin.routes['private-order-photo'] = {
      type: 'admin',
      prefix: '/admin',
      routes: [
        {
          method: 'GET',
          path: '/commandes/:documentId/photo',
          handler: async (ctx) => {
            const { documentId } = ctx.params;
            if (!documentId) return ctx.badRequest('Identifiant de commande manquant.');

            const photos = await strapi
              .service('api::commande.commande')
              .getPrivatePhotos(documentId);
            if (!photos.length) return ctx.notFound('Photo privée introuvable.');

            ctx.body = {
              data: {
                photos: photos.map(({ format, quantity }) => ({ format, quantity })),
              },
            };
          },
          config: {
            policies: [
              'admin::isAuthenticatedAdmin',
              { name: 'admin::hasPermissions', config: { actions: [{ action: 'plugin::content-manager.explorer.read', subject: 'api::commande.commande' }] } },
            ],
          },
        },
        {
          method: 'GET',
          path: '/commandes/:documentId/photo/:index',
          handler: async (ctx) => {
            const { documentId, index } = ctx.params;
            const photoIndex = Number(index);
            if (!documentId || !Number.isInteger(photoIndex) || photoIndex < 0) return ctx.badRequest('Photo privée invalide.');

            const photos = await strapi
              .service('api::commande.commande')
              .getPrivatePhotos(documentId);
            const photo = photos[photoIndex];
            if (!photo) return ctx.notFound('Photo privée introuvable.');

            const response = await fetch(photo.url, { signal: AbortSignal.timeout(30000) });
            if (!response.ok) return ctx.throw(502, 'Impossible de charger la photo privée.');

            ctx.set('Cache-Control', 'private, no-store');
            ctx.type = response.headers.get('content-type') || 'application/octet-stream';
            ctx.body = Buffer.from(await response.arrayBuffer());
          },
          config: {
            policies: [
              'admin::isAuthenticatedAdmin',
              { name: 'admin::hasPermissions', config: { actions: [{ action: 'plugin::content-manager.explorer.read', subject: 'api::commande.commande' }] } },
            ],
          },
        },
      ],
    };
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    const commandes = strapi.documents('api::commande.commande');
    let corrected = 0;

    for (let start = 0; ; start += 100) {
      const orders = await commandes.findMany({
        fields: ['details', 'type_commande'],
        sort: ['id:asc'],
        start,
        limit: 100,
      });

      for (const order of orders) {
        const typeCommande = order.details?.type === 'bon_cadeau' ? 'bon_cadeau' : 'tirage';
        if (order.type_commande === typeCommande) continue;

        await commandes.update({
          documentId: order.documentId,
          data: { type_commande: typeCommande },
        });
        corrected += 1;
      }

      if (orders.length < 100) break;
    }

    if (corrected) strapi.log.info(`${corrected} commande(s) existante(s) classée(s) par type.`);

    const publicRole = await strapi.db
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'public' } });
    if (!publicRole) return;

    const deniedPrefixes = [
      'api::commande.commande',
      'api::reservation.reservation',
      'api::payment-operation.payment-operation',
      'plugin::upload',
    ];
    const permissions = await strapi.db
      .query('plugin::users-permissions.permission')
      .findMany({ where: { role: publicRole.id } });

    for (const permission of permissions) {
      if (!permission.enabled) continue;
      if (!deniedPrefixes.some((prefix) => permission.action.startsWith(prefix))) continue;
      await strapi.db.query('plugin::users-permissions.permission').update({
        where: { id: permission.id },
        data: { enabled: false },
      });
    }
  },
};
