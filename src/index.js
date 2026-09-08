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

            const url = await strapi
              .service('api::commande.commande')
              .getPrivatePhotoUrl(documentId);
            if (!url) return ctx.notFound('Photo privée introuvable.');

            ctx.body = { data: { url } };
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
  },
};
