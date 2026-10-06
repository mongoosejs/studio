'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const createSandbox = require('../../sandbox/createSandbox');
const readOperationOptions = require('../../helpers/readOperationOptions');
const operationOptions = require('../../helpers/operationOptions');

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
  },
  maxTimeMS: {
    $type: 'number'
  },
  readPreference: {
    $type: 'string',
    $enum: ['secondary', 'secondaryPreferred', 'primary']
  }
}).compile('ExecuteDocumentScriptParams');

module.exports = ({ db, options }) => async function executeDocumentScript(params) {
  const { model, documentId, script, roles } = new ExecuteDocumentScriptParams(params);

  await authorize('Model.executeDocumentScript', roles);

  if (db.models[model] == null) {
    throw new Error(`Model ${model} not found`);
  }

  const sandbox = createSandbox(db, { ...readOperationOptions(options, params) });

  try {
    const Model = sandbox.db.models[model];
    const doc = await Model.findById(documentId).
      setOptions(operationOptions(options, params, { sanitizeFilter: true })).
      orFail();
    sandbox.context.doc = doc;

    const result = await sandbox.runScript({ script });

    return {
      result,
      logs: sandbox.getLogs()
    };
  } finally {
    try {
      await sandbox.close();
    } catch (_) {
      // Ignore sandbox cleanup errors so they do not mask the primary result.
    }
  }
};

module.exports.paramsType = ExecuteDocumentScriptParams;
module.exports.tags = [];
