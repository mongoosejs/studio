'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

const ListModelsParams = new Archetype({
  roles: {
    $type: ['string']
  }
}).compile('ListModelsParams');

module.exports = ({ db }) => async function listModels(params) {
  const { roles } = new ListModelsParams(params);
  await authorize('Model.listModels', roles);

  return {
    models: Object.keys(db.models).filter(key => !key.startsWith('__Studio_')).sort()
  };
};
