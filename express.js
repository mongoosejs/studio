'use strict';

const Backend = require('./backend');
const express = require('express');
const frontend = require('./frontend');
const { toRoute, objectRouter } = require('extrovert');

module.exports = async function(apiUrl, conn, options) {
  const router = express.Router();

  const mothershipUrl = options?._mothershipUrl || 'https://mongoose-js.netlify.app/.netlify/functions';
  let workspace = null;
  if (options?.apiKey) {
    ({ workspace } = await fetch(`${mothershipUrl}/getWorkspace`, {
      method: 'POST',
      body: JSON.stringify({ apiKey: options.apiKey }),
      headers: {
        'Authorization': `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json'
      }
    })
      .then(response => {
        if (response.status < 200 || response.status >= 400) {
          return response.json().then(data => {
            throw new Error(`Mongoose Studio API Key Error ${response.status}: ${require('util').inspect(data)}`);
          });
        }
        return response;
      })
      .then(res => res.json()));
  }

  apiUrl = apiUrl || 'api';
  const backend = Backend(conn, options?.studioConnection, options);

  router.use(
    '/api',
    function authorize(req, res, next) {
      if (!workspace) {
        next();
        return;
      }
      const authorization = req.headers.authorization;
      const params = {
        method: 'POST',
        body: JSON.stringify({ workspaceId: workspace._id }),
        headers: {
          'Authorization': authorization,
          'Content-Type': 'application/json'
        }
      };
      fetch(`${mothershipUrl}/me`, params)
        .then(response => {
          if (response.status < 200 || response.status >= 400) {
            return response.json().then(data => {
              throw new Error(`Mongoose Studio API Key Error ${response.status}: ${require('util').inspect(data)}`);
            });
          }
          return response;
        })
        .then(res => res.json())
        .then(({ user, roles }) => {
          if (!user || !roles) {
            throw new Error('Not authorized');
          }
          req._internals = req._internals || {};
          req._internals.authorization = authorization;
          req._internals.initiatedById = user._id;
          req._internals.roles = roles;
          req._internals.$workspaceId = workspace._id;

          next();
        })
        .catch(err => next(err));
    },
    express.json(),
    objectRouter(backend, toRoute)
  );

  console.log('Workspace', workspace);
  const { config } = await frontend(apiUrl, false, options, workspace);
  config.enableTaskVisualizer = options.enableTaskVisualizer;
  router.get('/config.js', function (req, res) {
    res.setHeader('Content-Type', 'application/javascript');
    res.end(`window.MONGOOSE_STUDIO_CONFIG = ${JSON.stringify(config, null, 2)};`);
  });

  router.use(express.static(`${__dirname}/frontend/public`));

  return router;
}
