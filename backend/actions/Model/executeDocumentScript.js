'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const mongoose = require('mongoose');
const util = require('util');
const vm = require('vm');

const ExecuteDocumentScriptParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  documentId: {
    $type: 'string',
    $required: true
  },
  script: {
    $type: 'string',
    $required: true
  },
  roles: {
    $type: ['string']
  }
}).compile('ExecuteDocumentScriptParams');

module.exports = ({ db }) => async function executeDocumentScript(params) {
  const { model, documentId, script, roles } = new ExecuteDocumentScriptParams(params);

  await authorize('Model.executeDocumentScript', roles);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  const doc = await Model.findById(documentId).setOptions({ sanitizeFilter: true }).orFail();

  const logs = [];
  if (!db.Types) {
    db.Types = mongoose.Types;
  }
  const sandbox = { db, mongoose, doc, console: {}, ObjectId: mongoose.Types.ObjectId };

  sandbox.console.log = function() {
    const args = Array.from(arguments);
    logs.push(args.map(arg => typeof arg === 'object' ? util.inspect(arg) : arg).join(' '));
  };

  const context = vm.createContext(sandbox);
  const result = await vm.runInContext(wrappedScript(script), context);

  return {
    result,
    logs: logs.join('\n')
  };
};

const wrappedScript = script => `(async () => {
  ${script}
})()`;
