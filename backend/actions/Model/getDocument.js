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
    const schemaPath = Model.schema.paths[path];
    const rawEnumValues = Array.isArray(schemaPath?.options?.enum) && schemaPath.options.enum.length > 0 ?
      schemaPath.options.enum : schemaPath?.enumValues;
    const enumValues = Array.isArray(rawEnumValues) ? rawEnumValues.filter(value => value != null) : undefined;
    schemaPaths[path] = {
      instance: schemaPath.instance,
      path,
      ref: schemaPath.options?.ref,
      enumValues: Array.isArray(enumValues) && enumValues.length > 0 ? enumValues : undefined
    };
  }
  removeSpecifiedPaths(schemaPaths, '.$*');

  return { doc: doc.toJSON({ virtuals: true, getters: false, transform: false }), schemaPaths };
};
