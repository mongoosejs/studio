'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const evaluateFilter = require('../../helpers/evaluateFilter');
const formatFilterForMongoShell = require('../../helpers/formatFilterForMongoShell');

const FormatSearchFilterParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  searchText: {
    $type: 'string',
    $required: true
  },
  roles: {
    $type: ['string']
  }
}).compile('FormatSearchFilterParams');

module.exports = ({ db }) => async function formatSearchFilter(params) {
  const { model, searchText, roles } = new FormatSearchFilterParams(params);
  await authorize('Model.formatSearchFilter', roles);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  const parsedFilter = evaluateFilter(searchText);
  const filter = parsedFilter == null ? {} : parsedFilter;
  const filterSyntax = formatFilterForMongoShell(filter);
  const collectionName = Model.collection.collectionName;
  const command = `db.getCollection(${JSON.stringify(collectionName)}).find(${filterSyntax})`;

  return {
    filter: filterSyntax,
    command
  };
};
