'use strict';

module.exports = {
  type: 'admin',
  routes: [
    {
      method: 'GET',
      path: '/commandes/:documentId/photo',
      handler: 'commande.getPrivatePhoto',
      config: {
        policies: [],
      },
    },
  ],
};
