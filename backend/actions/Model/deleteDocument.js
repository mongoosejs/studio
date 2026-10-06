'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const operationOptions = require('../../helpers/operationOptions');

const DeleteDocumentParams = new Archetype({
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
  }
}).compile('DeleteDocumentParams');

module.exports = ({ db, options }) => async function DeleteDocument(params) {
  const { model, documentId, roles } = new DeleteDocumentParams(params);

  const Model = db.models[model];

  await authorize('Model.deleteDocument', roles);

  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  const doc = await Model.
    deleteOne({ _id: documentId }).
    setOptions(operationOptions(options, params, { sanitizeFilter: true })).
    orFail();

  return { doc };
};

module.exports.paramsType = DeleteDocumentParams;
module.exports.tags = ['destructive'];
