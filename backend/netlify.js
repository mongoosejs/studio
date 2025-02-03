'use strict';

const Backend = require('./');
const { toNetlifyFunction } = require('extrovert');

module.exports = function netlify(options) {
  const backend = Backend();
  const mothershipUrl = options?._mothershipUrl || 'https://mongoose-js.netlify.app/.netlify/functions';

  let workspace = null;

  return toNetlifyFunction(async function wrappedNetlifyFunction(params) {
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

      const { user, roles } = await fetch(`${mothershipUrl}/me`, { ...params, workspaceId: workspace._id })
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

    return actionFn(params);
  });
}
