'use strict';

const Backend = require('./backend');
const express = require('express');
const frontend = require('./frontend');
const { toRoute, objectRouter } = require('extrovert');

module.exports = function(apiUrl, conn, options) {
  const router = express.Router();

  apiUrl = apiUrl || '/admin/api';
  const backend = Backend(conn);

  router.use('/api', express.json(), objectRouter(backend, toRoute));

  frontend(apiUrl, false, options);

  router.use(express.static(`${__dirname}/frontend/public`));

  return router;
}
