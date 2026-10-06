'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const readOperationOptions = require('../../helpers/readOperationOptions');
const validateDocumentWithTimeout = require('../../helpers/validateDocumentWithTimeout');

const ValidateDocumentParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  documentId: {
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
}).compile('ValidateDocumentParams');

module.exports = ({ db, options }) => async function validateDocument(params) {
  const { model, documentId, roles } = new ValidateDocumentParams(params);

  await authorize('Model.validateDocument', roles);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  const doc = await Model.findById(documentId).
    setOptions(readOperationOptions(options, { sanitizeFilter: true })).
    orFail();
  return {
    result: await validateDocumentWithTimeout(doc)
  };
};

module.exports.paramsType = ValidateDocumentParams;
module.exports.tags = ['readOnly'];
