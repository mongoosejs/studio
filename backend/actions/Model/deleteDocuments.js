'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const operationOptions = require('../../helpers/operationOptions');

const DeleteDocumentsParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  documentIds: {
    $type: ['string'],
    $required: true
  },
  roles: {
    $type: ['string']
  },
  maxTimeMS: {
    $type: 'number'
  }
}).compile('DeleteDocumentsParams');

module.exports = ({ db, options }) => async function DeleteDocuments(params) {
  const { model, documentIds, roles } = new DeleteDocumentsParams(params);

  const Model = db.models[model];

  await authorize('Model.deleteDocuments', roles);

  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  await Model.
    deleteMany({ _id: { $in: documentIds } }).
    setOptions(operationOptions(options, params)).
    orFail();

  return { };
};

module.exports.paramsType = DeleteDocumentsParams;
module.exports.tags = ['destructive'];
