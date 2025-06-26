'use strict';

const Archetype = require('archetype');
const mongoose = require('mongoose');
const { stringify } = require('csv-stringify/sync');
const authorize = require('../../authorize');

const GetDocumentsParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  filter: {
    $type: Archetype.Any
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
  let { filter } = params;
  const { model, propertiesToInclude, roles } = params;

  await authorize('Model.exportQueryResults', roles);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  if (typeof filter === 'string') {
    filter = { '$**': filter };
  }

  const docs = await Model.
    find(filter == null ? {} : filter).
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
    'Content-Disposition': `attachment; filename="${model.toLowerCase()}-export.csv"`,
  });
  return csv;
};
