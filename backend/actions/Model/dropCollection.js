'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

const DropCollectionParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  roles: {
    $type: ['string']
  }
}).compile('DropCollectionParams');

module.exports = ({ db }) => async function dropCollection(params) {
  const { model, roles } = new DropCollectionParams(params);

  await authorize('Model.dropCollection', roles);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  await Model.collection.drop();

  return { ok: true };
};
