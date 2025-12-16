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
    const schemaType = Model.schema.paths[path];
    schemaPaths[path] = {
      instance: schemaType.instance,
      path,
      ref: schemaType.options?.ref,
      required: schemaType.options?.required,
      enum: schemaType.options?.enum
    };

    if (schemaType.schema) {
      schemaPaths[path].schema = {};
      for (const subpath of Object.keys(schemaType.schema.paths)) {
        const subSchemaType = schemaType.schema.paths[subpath];
        schemaPaths[path].schema[subpath] = {
          instance: subSchemaType.instance,
          path: subpath,
          ref: subSchemaType.options?.ref,
          required: subSchemaType.options?.required,
          enum: subSchemaType.options?.enum
        };
      }
    }
  }
  removeSpecifiedPaths(schemaPaths, '.$*');

  const virtualPaths = Object.keys(Model.schema.virtuals);

  return { doc: doc.toJSON({ virtuals: true, getters: false, transform: false }), schemaPaths, virtualPaths };
};
