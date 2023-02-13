'use strict';

const Backend = require('./backend');
const express = require('express');
const frontend = require('./frontend');
const { toRoute } = require('extrovert');

module.exports = function(apiUrl, conn, options) {
  const router = express.Router();

  apiUrl = apiUrl || '/admin/api';
  const backend = Backend(conn);

  const apiRouter = express.Router();
  apiRouter.use(express.json());
  for (const [name, actions] of Object.entries(backend)) {
    const subrouter = express.Router();
    for (const [actionName, action] of Object.entries(actions)) {
      subrouter.options(`/${actionName}`, (req, res) => res.send(''));
      subrouter.get(`/${actionName}`, toRoute(action));
      subrouter.put(`/${actionName}`, toRoute(action));
      subrouter.post(`/${actionName}`, toRoute(action));
      subrouter.delete(`/${actionName}`, toRoute(action));
    }

    apiRouter.use(`/${name}`, subrouter);
  }

  router.use('/api', apiRouter);

  frontend(apiUrl, false, options);

  router.use(express.static(`${__dirname}/frontend/public`));

  return router;
}