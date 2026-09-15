'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const createSandbox = require('../../sandbox/createSandbox');
const omitNullish = require('../../helpers/omitNullish');

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

module.exports = ({ db, options }) => async function executeDocumentScript(params) {
  const { model, documentId, script, roles } = new ExecuteDocumentScriptParams(params);

  await authorize('Model.executeDocumentScript', roles);

  if (db.models[model] == null) {
    throw new Error(`Model ${model} not found`);
  }

  const sandbox = createSandbox({ db, maxTimeMS: options?.maxTimeMS });

  try {
    const Model = sandbox.db.models[model];
    const doc = await Model.findById(documentId).
      setOptions(omitNullish({ sanitizeFilter: true, maxTimeMS: options?.maxTimeMS })).
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
