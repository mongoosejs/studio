'use strict';

const Archetype = require('archetype');
const removeSpecifiedPaths = require('../../helpers/removeSpecifiedPaths');
const { EJSON } = require('bson');
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
  filter: {
    $type: Archetype.Any
  },
  sort: {
    $type: Archetype.Any
  },
  roles: {
    $type: ['string']
  }
}).compile('GetDocumentsParams');

module.exports = ({ db }) => async function getDocuments(params) {
  params = new GetDocumentsParams(params);
  const { roles } = params;
  await authorize('Model.getDocuments', roles);

  let { filter } = params;
  if (filter != null && Object.keys(filter).length > 0) {
    filter = EJSON.parse(filter);
  }
  const { model, limit, skip, sort } = params;

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  if (typeof filter === 'string') {
    filter = { '$**': filter };
  }

  const hasSort = typeof sort === 'object' && sort != null && Object.keys(sort).length > 0;
  const sortObj = hasSort ? { ...sort } : {};
  if (!sortObj.hasOwnProperty('_id')) {
    sortObj._id = -1;
  }
  const cursor = await Model.
    find(filter == null ? {} : filter).
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

  const numDocuments = filter == null ?
    await Model.estimatedDocumentCount() :
    await Model.countDocuments(filter);

  return {
    docs: docs.map(doc => doc.toJSON({ virtuals: false, getters: false, transform: false })),
    schemaPaths,
    numDocs: numDocuments
  };
};
