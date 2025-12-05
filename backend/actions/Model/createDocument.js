'use strict';

const Archetype = require('archetype');
const { EJSON } = require('mongodb/lib/bson');
const authorize = require('../../authorize');

const CreateDocumentParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  data: {
    $type: Archetype.Any,
    $required: true
  },
  roles: {
    $type: ['string']
  }
}).compile('CreateDocumentParams');

module.exports = ({ db }) => async function CreateDocument(params) {
  const { model, data, roles } = new CreateDocumentParams(params);

  await authorize('Model.createDocument', roles);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  const doc = await Model.create(EJSON.deserialize(data));

  return { doc };
};
