'use strict';

const Backend = require('./');
const { toNetlifyFunction } = require('extrovert');

module.exports = function netlify(options) {
  const backend = Backend();

  return toNetlifyFunction(async function wrappedNetlifyFunction(params) {
    const actionName = params?.action;
    const authorization = params?.authorization;
    if (options?.apiKey) {
      if (!authorization) {
        throw new Error('Not authorized');
      }

      const { user, roles } = await fetch(`${mothershipUrl}/me`, params)
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
