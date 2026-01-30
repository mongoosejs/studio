'use strict';

const Backend = require('./');

module.exports = function next(conn, options) {
  const backend = Backend(conn, options?.studioConnection, options);

  const mothershipUrl = options?._mothershipUrl || 'https://mongoose-js.netlify.app/.netlify/functions';
  let workspace = null;

  return async function wrappedNextJSFunction(req, res) {
    const params = { ...req.query, ...req.body, ...req.params };
    const actionName = params?.action;

    const authorization = params?.authorization;
    if (options?.apiKey) {
      if (!authorization) {
        throw new Error('Not authorized');
      }

      if (workspace == null) {
        ({ workspace } = await fetch(`${mothershipUrl}/getWorkspace`, {
          method: 'POST',
          body: JSON.stringify({ apiKey: options.apiKey }),
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            'Content-Type': 'application/json'
          }
        })
          .then(response => {
            if (response.status < 200 || response.status >= 400) {
              return response.json().then(data => {
                throw new Error(`Error getting workspace ${response.status}: ${require('util').inspect(data)}`);
              });
            }
            return response;
          })
          .then(res => res.json()));
      }

      const { user, roles } = await fetch(`${mothershipUrl}/me?`, {
        method: 'POST',
        body: JSON.stringify({ workspaceId: workspace._id }),
        headers: {
          Authorization: authorization,
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
        .then(res => res.json());
      if (!user || !roles) {
        throw new Error('Not authorized');
      }

      params.$workspaceId = workspace._id;
      params.roles = roles;
      params.userId = user._id;
      params.initiatedById = user._id;
    }

    if (typeof actionName !== 'string') {
      throw new Error('No action specified');
    }
    const pieces = actionName.split('.').filter(p => p !== '__proto__' && p !== 'contructor');
    let actionFn = backend;
    for (const piece of pieces) {
      if (actionFn == null) {
        throw new Error(`Action ${actionName} not found`);
      }
      actionFn = actionFn[piece];
    }
    if (typeof actionFn !== 'function') {
      throw new Error(`Action ${actionName} not found`);
    }

    return actionFn(params)
      .then(result => {
        res.status(200).json(result);
        return result;
      })
      .catch(error => res.status(500).json({ message: error.message }));
  };
};
