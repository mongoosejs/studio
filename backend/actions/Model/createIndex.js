'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

const CreateIndexParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  key: {
    $type: Object,
    $required: true
  },
  options: {
    $type: Object
  },
  roles: {
    $type: ['string']
  }
}).compile('CreateIndexParams');

module.exports = ({ db }) => async function createIndex(params) {
  const { model, key, options, roles } = new CreateIndexParams(params);

  await authorize('Model.createIndex', roles);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  await Model.collection.createIndex(key, options);

  const mongoDBIndexes = await Model.listIndexes();
  const diffIndexes = await Model.diffIndexes({ indexOptionsToCreate: true });
  return {
    mongoDBIndexes,
    diffIndexes
  };
};

module.exports.paramsType = CreateIndexParams;
module.exports.tags = [];
