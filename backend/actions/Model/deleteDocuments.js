'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

const DeleteDocumentsParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  documentIds: {
    $type: 'string',
    $required: true
  },
  roles: {
    $type: ['string']
  }
}).compile('DeleteDocumentsParams');

module.exports = ({ db }) => async function DeleteDocuments(params) {
  const { model, documentIds, roles } = new DeleteDocumentsParams(params);

  const Model = db.models[model];

  await authorize('Model.deleteDocuments', roles);

  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  await Model.
    deleteMany({ _id: { $in: documentIds } }).
    setOptions({ sanitizeFilter: true }).
    orFail();


  return { };
};
