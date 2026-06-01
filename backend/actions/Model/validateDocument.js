'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
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
  }
}).compile('ValidateDocumentParams');

module.exports = ({ db }) => async function validateDocument(params) {
  const { model, documentId, roles } = new ValidateDocumentParams(params);

  await authorize('Model.validateDocument', roles);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  const doc = await Model.findById(documentId).setOptions({ sanitizeFilter: true }).orFail();
  return {
    result: await validateDocumentWithTimeout(doc)
  };
};
