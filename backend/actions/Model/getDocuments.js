'use strict';

const Archetype = require('archetype');

const GetDocumentsParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  filter: {
    $type: Object
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
  }
}).compile('GetDocumentsParams');

module.exports = ({ db }) => async function getDocuments(params) {
  const { model, filter, limit, skip } = new GetDocumentsParams(params);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  const docs = await Model.
    find(filter == null ? {} : filter).
    setOptions({ sanitizeFilter: true }).
    limit(limit).
    skip(skip);
  
  return { docs, schemaPaths: Model.schema.paths };
};