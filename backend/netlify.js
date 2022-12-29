'use strict';

const Backend = require('./');
const { toNetlifyFunction } = require('extrovert');

module.exports = function netlify() {
  const backend = Backend();

  return toNetlifyFunction(function wrappedNetlifyFunction(params) {
    const actionName = params?.action;
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