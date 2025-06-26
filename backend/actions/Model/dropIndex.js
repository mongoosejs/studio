'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

const DropIndexParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  name: {
    $type: 'string',
    $required: true
  },
  roles: {
    $type: ['string']
  }
}).compile('DropIndexParams');

module.exports = ({ db }) => async function getIndexes(params) {
  const { model, name, roles } = new DropIndexParams(params);

  await authorize('Model.dropIndex', roles);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  await Model.dropIndex(name);

  const mongoDBIndexes = await Model.listIndexes();
  return {
    mongoDBIndexes
  };
};
