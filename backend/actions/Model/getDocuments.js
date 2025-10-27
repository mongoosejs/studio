'use strict';

const Archetype = require('archetype');
const removeSpecifiedPaths = require('../../helpers/removeSpecifiedPaths');
const evaluateFilter = require('../../helpers/evaluateFilter');
const authorize = require('../../authorize');

const GetDocumentsParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  limit: {
    $type: 'number',
    $required: true,
    $default: 20
  },
  skip: {
    $type: 'number',
    $required: true,
    $default: 0
  },
  searchText: {
    $type: 'string'
  },
  sortKey: {
    $type: 'string'
  },
  sortDirection: {
    $type: 'number'
  },
  roles: {
    $type: ['string']
  }
}).compile('GetDocumentsParams');

module.exports = ({ db }) => async function getDocuments(params) {
  params = new GetDocumentsParams(params);
  const { roles } = params;
  await authorize('Model.getDocuments', roles);

  const { model, limit, skip, sortKey, sortDirection, searchText } = params;

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  const parsedFilter = evaluateFilter(searchText);
  const filter = parsedFilter == null ? {} : parsedFilter;

  const sortObj = {};

  if (typeof sortKey === 'string' && sortKey.trim().length > 0) {
    if (sortDirection !== 1 && sortDirection !== -1) {
      throw new Error('Invalid sortDirection. Must be 1 or -1');
    }
    sortObj[sortKey.trim()] = sortDirection;
  }
  if (!sortObj.hasOwnProperty('_id')) {
    sortObj._id = -1;
  }
  const cursor = await Model.
    find(filter).
    limit(limit).
    skip(skip).
    sort(sortObj).
    cursor();
  const docs = [];
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    docs.push(doc);
  }

  const schemaPaths = {};
  for (const path of Object.keys(Model.schema.paths)) {
    schemaPaths[path] = {
      instance: Model.schema.paths[path].instance,
      path,
      ref: Model.schema.paths[path].options?.ref,
      required: Model.schema.paths[path].options?.required
    };
  }
  removeSpecifiedPaths(schemaPaths, '.$*');

  const numDocuments = parsedFilter == null ?
    await Model.estimatedDocumentCount() :
    await Model.countDocuments(filter);

  return {
    docs: docs.map(doc => doc.toJSON({ virtuals: false, getters: false, transform: false })),
    schemaPaths,
    numDocs: numDocuments
  };
};
