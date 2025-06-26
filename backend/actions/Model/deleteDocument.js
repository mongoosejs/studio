'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

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
    $type: ['string'],
  }
}).compile('DeleteDocumentParams');

module.exports = ({ db }) => async function DeleteDocument(params) {
  const { model, documentId, roles } = new DeleteDocumentParams(params);

  const Model = db.models[model];

  await authorize('Model.deleteDocument', roles);

  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  const doc = await Model.
    deleteOne({_id: documentId}).
    setOptions({ sanitizeFilter: true }).
    orFail();
    console.log('what is doc', doc);

  return { doc };
};
