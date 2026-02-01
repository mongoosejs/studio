'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const getRefFromSchemaType = require('../../helpers/getRefFromSchemaType');
const removeSpecifiedPaths = require('../../helpers/removeSpecifiedPaths');

const ListModelsParams = new Archetype({
  roles: {
    $type: ['string']
  }
}).compile('ListModelsParams');

module.exports = ({ db }) => async function listModels(params) {
  const { roles } = new ListModelsParams(params);
  await authorize('Model.listModels', roles);

  const readyState = db.connection?.readyState ?? db.readyState;

  const models = Object.keys(db.models).filter(key => !key.startsWith('__Studio_')).sort();

  const modelSchemaPaths = {};
  for (const modelName of models) {
    const Model = db.models[modelName];
    const schemaPaths = {};
    modelSchemaPaths[modelName] = schemaPaths;
    for (const path of Object.keys(Model.schema.paths)) {
      const schemaType = Model.schema.paths[path];
      schemaPaths[path] = {
        instance: schemaType.instance,
        path,
        ref: getRefFromSchemaType(schemaType),
        required: schemaType.options?.required,
        enum: schemaType.options?.enum
      };
      if (schemaType.schema) {
        schemaPaths[path].schema = {};
        for (const subpath of Object.keys(schemaType.schema.paths)) {
          schemaPaths[path].schema[subpath] = {
            instance: schemaType.schema.paths[subpath].instance,
            path: subpath,
            ref: getRefFromSchemaType(schemaType.schema.paths[subpath]),
            required: schemaType.schema.paths[subpath].options?.required,
            enum: schemaType.schema.paths[subpath].options?.enum
          };
        }
      }
    }
  }

  return {
    models: Object.keys(db.models).filter(key => !key.startsWith('__Studio_')).sort(),
    modelSchemaPaths,
    readyState
  };
};
