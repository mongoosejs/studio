'use strict';

const Archetype = require('archetype');
const mongoose = require('mongoose');

const authorize = require('../../authorize');

const CreateScriptParams = new Archetype({
  initiatedById: {
    $type: mongoose.Types.ObjectId
  },
  script: {
    $type: 'string',
    $required: true
  },
  roles: {
    $type: ['string']
  }
}).compile('CreateScriptParams');

module.exports = ({ studioConnection, options }) => async function createScript(params) {
  const { initiatedById, script, roles } = new CreateScriptParams(params);

  await authorize('Script.createScript', roles);

  const Script = studioConnection.model('__Studio_Script');
  const createdScript = await Script.create({ script, userId: initiatedById });
  const baseUrl = options?.workspace?.baseUrl?.replace(/\/+$/, '');
  const url = `${baseUrl ? `${baseUrl}/` : ''}#/script/${createdScript._id}`;

  return { script: createdScript, url };
};

module.exports.paramsType = CreateScriptParams;
module.exports.tags = [];
module.exports.description = 'Create a script for the user to review, edit, dry run, or run in Mongoose Studio. This tool does not execute the script and returns a review URL.';
