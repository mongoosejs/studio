'use strict';

const Backend = require('./');
const { toNetlifyFunction } = require('extrovert');

module.exports = function next() {
  const backend = Backend();

  return function wrappedNextJSFunction(req, res) {
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

    const params = { ...req.query, ...req.body, ...req.params };
    return actionFn(params)
      .then(result => res.status(200).json(result))
      .catch(error => res.status(500).json({ message: error.message }));
  };
}
