'use strict';

const Archetype = require('archetype');
const getSuggestedProjection = require('../../helpers/getSuggestedProjection');
const authorize = require('../../authorize');

const GetSuggestedProjectionParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  roles: {
    $type: ['string']
  }
}).compile('GetSuggestedProjectionParams');

module.exports = ({ db }) => async function getSuggestedProjectionAction(params) {
  params = new GetSuggestedProjectionParams(params);
  const { roles } = params;
  await authorize('Model.getSuggestedProjection', roles);

  const { model } = params;

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  // Default columns: first N schema paths (no scoring).
  const suggestedFields = getSuggestedProjection(Model);

  return { suggestedFields };
};
