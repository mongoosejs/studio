'use strict';

const Archetype = require('archetype');

const GetDocumentsParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  limit: {
    $type: 'number',
    $required: true,
    $default: 50
  },
  skip: {
    $type: 'number',
    $required: true,
    $default: 0
  },
  filter: {
    $type: Archetype.Any
  }
}).compile('GetDocumentsParams');

module.exports = ({ db }) => async function getDocuments(params) {
  params = new GetDocumentsParams(params);
  let { filter } = params;
  const { model, limit, skip } = params;

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
    limit(limit).
    skip(skip).
    sort({ _id: -1 });
  
  return { docs, schemaPaths: Model.schema.paths };
};