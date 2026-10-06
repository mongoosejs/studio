'use strict';

const Archetype = require('archetype');
const mongoose = require('mongoose');

const authorize = require('../../authorize');
const operationOptions = require('../../helpers/operationOptions');

const GetScriptParams = new Archetype({
  initiatedById: {
    $type: mongoose.Types.ObjectId
  },
  scriptId: {
    $type: mongoose.Types.ObjectId,
    $required: true
  },
  roles: {
    $type: ['string']
  },
  maxTimeMS: {
    $type: 'number'
  }
}).compile('GetScriptParams');

module.exports = ({ studioConnection, options }) => async function getScript(params) {
  const { initiatedById, scriptId, roles } = new GetScriptParams(params);

  await authorize('Script.getScript', roles);

  const Script = studioConnection.model('__Studio_Script');
  const script = await Script.findById(scriptId).setOptions(operationOptions(options, params));
  if (script == null) {
    throw new Error('Script not found');
  }
  if (initiatedById && script.userId?.toString() !== initiatedById.toString()) {
    throw new Error('Unauthorized');
  }

  return { script };
};

module.exports.paramsType = GetScriptParams;
module.exports.tags = ['readOnly'];
