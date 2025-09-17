'use strict';

const Archetype = require('archetype');
const mongoose = require('mongoose');
const { stringify } = require('csv-stringify/sync');
const authorize = require('../../authorize');
const evaluateFilter = require('../../helpers/evaluateFilter');

const GetDocumentsParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  searchText: {
    $type: 'string'
  },
  propertiesToInclude: {
    $type: ['string'],
    $required: true,
    $transform: v => {
      if (typeof v === 'string') {
        return decodeURIComponent(v).split(',');
      }
      return v;
    }
  },
  roles: {
    $type: ['string']
  }
}).compile('GetDocumentsParams');

module.exports = ({ db }) => async function exportQueryResults(params, req, res) {
  params = new GetDocumentsParams(params);
  const { model, propertiesToInclude, roles, searchText } = params;

  await authorize('Model.exportQueryResults', roles);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  const parsedFilter = evaluateFilter(searchText);
  const filter = parsedFilter == null ? {} : parsedFilter;

  const docs = await Model.
    find(filter).
    setOptions({ sanitizeFilter: true }).
    sort({ _id: -1 });

  const rows = [propertiesToInclude];
  for (const doc of docs) {
    rows.push(propertiesToInclude.map(prop => {
      const val = doc.$get(prop);
      if (val instanceof mongoose.Types.ObjectId) {
        return val.toString();
      }
      if (val instanceof Date) {
        return val.toISOString();
      }
      return val;
    }));
  }
  const csv = stringify(rows);

  res.set({
    'Content-Type': 'text/csv',
    'Content-Disposition': `attachment; filename="${model.toLowerCase()}-export.csv"`
  });
  return csv;
};
