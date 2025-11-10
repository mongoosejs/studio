'use strict';

const Archetype = require('archetype');
const removeSpecifiedPaths = require('../../helpers/removeSpecifiedPaths');
const authorize = require('../../authorize');

const GetDocumentParams = new Archetype({
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
}).compile('GetDocumentParams');

module.exports = ({ db }) => async function getDocument(params) {
  const { model, documentId, roles } = new GetDocumentParams(params);

  await authorize('Model.getDocument', roles);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  const doc = await Model.
    findById(documentId).
    setOptions({ sanitizeFilter: true }).
    orFail();
  const schemaPaths = {};
  for (const path of Object.keys(Model.schema.paths)) {
    schemaPaths[path] = {
      instance: Model.schema.paths[path].instance,
      path,
      ref: Model.schema.paths[path].options?.ref,
      required: Model.schema.paths[path].options?.required,
      enum: Model.schema.paths[path].options?.enum
    };
  }
  removeSpecifiedPaths(schemaPaths, '.$*');

  const virtualPaths = Object.keys(Model.schema.virtuals);

  return { doc: doc.toJSON({ virtuals: true, getters: false, transform: false }), schemaPaths, virtualPaths };
};
