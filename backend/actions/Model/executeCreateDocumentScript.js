'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const mongoose = require('mongoose');
const util = require('util');
const vm = require('vm');
const { EJSON } = require('mongoose').mongo.BSON;

const ExecuteCreateDocumentScriptParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  data: {
    $type: Archetype.Any,
    $required: true
  },
  script: {
    $type: 'string',
    $required: true
  },
  roles: {
    $type: ['string']
  }
}).compile('ExecuteCreateDocumentScriptParams');

module.exports = ({ db }) => async function executeCreateDocumentScript(params) {
  const { model, data, script, roles } = new ExecuteCreateDocumentScriptParams(params);

  await authorize('Model.executeCreateDocumentScript', roles);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  const draft = EJSON.deserialize(data);

  const logs = [];
  if (!db.Types) {
    db.Types = mongoose.Types;
  }
  const sandbox = {
    db,
    mongoose,
    Model,
    draft,
    console: {},
    ObjectId: mongoose.Types.ObjectId
  };

  sandbox.console.log = function() {
    const args = Array.from(arguments);
    logs.push(args.map(arg => typeof arg === 'object' ? util.inspect(arg) : arg).join(' '));
  };

  const context = vm.createContext(sandbox);
  const result = await vm.runInContext(wrappedScript(script), context);

  return {
    result,
    draft: EJSON.serialize(draft),
    logs: logs.join('\n')
  };
};

const wrappedScript = script => `(async () => {
  ${script}
})()`;
