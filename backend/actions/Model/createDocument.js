'use strict';

const Archetype = require('archetype');
const { EJSON } = require('bson');

const CreateDocumentParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  data: {
    $type: Archetype.Any,
    $required: true
  }
}).compile('CreateDocumentParams');

module.exports = ({ db }) => async function CreateDocument(params) {
  const { model, data } = new CreateDocumentParams(params);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }
  
  const doc = await Model.create(EJSON.deserialize(data));
  
  return { doc };
};