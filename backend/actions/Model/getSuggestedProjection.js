'use strict';

const Archetype = require('archetype');
const evaluateFilter = require('../../helpers/evaluateFilter');
const getSuggestedProjection = require('../../helpers/getSuggestedProjection');
const authorize = require('../../authorize');

const GetSuggestedProjectionParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  searchText: {
    $type: 'string'
  },
  roles: {
    $type: ['string']
  }
}).compile('GetSuggestedProjectionParams');

module.exports = ({ db }) => async function getSuggestedProjectionAction(params) {
  params = new GetSuggestedProjectionParams(params);
  const { roles } = params;
  await authorize('Model.getSuggestedProjection', roles);

  const { model, searchText } = params;

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  const parsedFilter = evaluateFilter(searchText);
  const filter = parsedFilter == null ? {} : parsedFilter;

  const suggestedFields = getSuggestedProjection(Model, { filter });

  return { suggestedFields };
};
