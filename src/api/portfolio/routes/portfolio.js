'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/portfolio/files',
      handler: 'portfolio.find',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
