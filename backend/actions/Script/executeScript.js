'use strict';

const Archetype = require('archetype');
const mongoose = require('mongoose');

const authorize = require('../../authorize');
const readOperationOptions = require('../../helpers/readOperationOptions');
const createSandbox = require('../../sandbox/createSandbox');

const ExecuteScriptParams = new Archetype({
  initiatedById: {
    $type: mongoose.Types.ObjectId
  },
  scriptId: {
    $type: mongoose.Types.ObjectId,
    $required: true
  },
  script: {
    $type: 'string'
  },
  dryRun: {
    $type: 'boolean',
    $default: false
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
}).compile('ExecuteScriptParams');

module.exports = ({ db, studioConnection, options }) => async function executeScript(params) {
  const { initiatedById, scriptId, script, dryRun, roles } = new ExecuteScriptParams(params);

  await authorize('Script.executeScript', roles);

  const Script = studioConnection.model('__Studio_Script');
  const scriptDoc = await Script.findById(scriptId);
  if (scriptDoc == null) {
    throw new Error('Script not found');
  }
  if (initiatedById && scriptDoc.userId?.toString() !== initiatedById.toString()) {
    throw new Error('Unauthorized');
  }

  let output = null;
  let error = null;

  if (script != null) {
    scriptDoc.script = script;
  }
  scriptDoc.dryRun = dryRun;
  scriptDoc.executionStartedAt = new Date();
  scriptDoc.executionFinishedAt = null;
  scriptDoc.executionResult = null;
  await scriptDoc.save();

  const sandbox = createSandbox(db, { ...readOperationOptions(options, params) });
  try {
    output = await sandbox.runScript({ script: scriptDoc.script, dryRun });
  } catch (err) {
    error = err;
  } finally {
    try {
      await sandbox.close();
    } catch (_) {
      // Ignore sandbox cleanup errors so they do not mask the primary result.
    }
  }

  scriptDoc.executionFinishedAt = new Date();
  scriptDoc.executionResult = { output, logs: sandbox.getLogs(), error: error?.message ?? null };
  await scriptDoc.save();

  if (error != null) {
    throw new Error(`Script execution failed: ${error.message}`);
  }

  return { script: scriptDoc };
};

module.exports.paramsType = ExecuteScriptParams;
module.exports.tags = [];
module.exports.mcp = false;
