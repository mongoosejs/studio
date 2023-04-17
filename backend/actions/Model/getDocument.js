'use strict';

const Archetype = require('archetype');
const removeSpecifiedPaths = require('../../helpers/removeSpecifiedPaths');

const GetDocumentParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  documentId: {
    $type: 'string',
    $required: true
  }
}).compile('GetDocumentParams');

module.exports = ({ db }) => async function getDocument(params) {
  const { model, documentId } = new GetDocumentParams(params);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  const doc = await Model.
    findById(documentId).
    setOptions({ sanitizeFilter: true }).
    orFail();
  const schemaPaths = Model.schema.paths
  removeSpecifiedPaths(schemaPaths, '.$*');
  
  return { doc, schemaPaths };
};