'use strict';

const Archetype = require('archetype');
const { EJSON } = require('bson');

const CreateDocumentParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  fields: {
    $type: Archetype.Any
  }
}).compile('CreateDocumentParams');

module.exports = ({ db }) => async function CreateDocument(params) {
  const { model, fields } = new CreateDocumentParams(params);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }
  if (!fields) {
    throw new Error(`No fields provided for document creation`)
  }
  console.log('what is fields', fields);
  console.log(EJSON.parse(fields))
  const doc = await Model.
    create(fields)
  
  return { doc };
};