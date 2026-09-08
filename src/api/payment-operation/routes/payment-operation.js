'use strict';

module.exports = {
  routes: [{ method: 'POST', path: '/payment-operations', handler: 'payment-operation.execute', config: { auth: false } }],
};
