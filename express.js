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

  apiUrl = apiUrl || '/admin/api';
  const backend = Backend(conn);

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

          next();
        })
        .catch(err => next(err));
    },
    express.json(),
    objectRouter(backend, toRoute)
  );

  console.log('Workspace', workspace);
  frontend(apiUrl, false, options, workspace);

  router.use(express.static(`${__dirname}/frontend/public`));

  return router;
}
