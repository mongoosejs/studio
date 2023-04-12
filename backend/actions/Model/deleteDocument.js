'use strict';

const Archetype = require('archetype');

const DeleteDocumentParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  documentId: {
    $type: 'string',
    $required: true
  }
}).compile('DeleteDocumentParams');

module.exports = ({ db }) => async function DeleteDocument(params) {
  const { model, documentId } = new DeleteDocumentParams(params);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  const doc = await Model.
    deleteOne({_id: documentId}).
    setOptions({ sanitizeFilter: true }).
    orFail();
    console.log('what is doc', doc);
  
  return { doc, schemaPaths: Model.schema.paths };
};