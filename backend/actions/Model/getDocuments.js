'use strict';

const Archetype = require('archetype');
const removeSpecifiedPaths = require('../../helpers/removeSpecifiedPaths');
const EJSON = require('ejson');

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
  console.log('what is filter', filter);
  if (JSON.stringify(filter) !== '{}' && filter != null) {
    filter = EJSON.parse(filter);
  }
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


  let schemaPaths = {};
  for (const path of Object.keys(Model.schema.paths)) {
    schemaPaths[path] = { instance: Model.schema.paths[path].instance, value: Model.schema.paths[path]}
  }
  removeSpecifiedPaths(schemaPaths, '.$*');
  const numDocuments = await Model.countDocuments(filter == null ? {} : filter);
  
  return { docs, schemaPaths, numDocs: numDocuments };
};