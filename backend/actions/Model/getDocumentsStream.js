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

module.exports = ({ db }) => async function* getDocumentsStream(params) {
  params = new GetDocumentsParams(params);
  const { roles } = params;
  await authorize('Model.getDocumentsStream', roles);

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

  const schemaPaths = {};
  for (const path of Object.keys(Model.schema.paths)) {
    const schemaType = Model.schema.paths[path];
    schemaPaths[path] = {
      instance: schemaType.instance,
      path,
      ref: schemaType.options?.ref,
      required: schemaType.options?.required,
      enum: schemaType.options?.enum
    };
    if (schemaType.schema) {
      schemaPaths[path].schema = {};
      for (const subpath of Object.keys(schemaType.schema.paths)) {
        schemaPaths[path].schema[subpath] = {
          instance: schemaType.schema.paths[subpath].instance,
          path: subpath,
          ref: schemaType.schema.paths[subpath].options?.ref,
          required: schemaType.schema.paths[subpath].options?.required,
          enum: schemaType.schema.paths[subpath].options?.enum
        };
      }
    }
  }
  removeSpecifiedPaths(schemaPaths, '.$*');

  yield { schemaPaths };

  // Start counting documents in parallel with streaming documents
  const numDocsPromise = (parsedFilter == null)
    ? Model.estimatedDocumentCount().exec()
    : Model.countDocuments(filter).exec();

  const cursor = await Model.
    find(filter).
    limit(limit).
    skip(skip).
    sort(sortObj).
    batchSize(1).
    cursor();

  let numDocsYielded = false;
  let numDocumentsPromiseResolved = false;
  let numDocumentsValue;
  let numDocumentsError;

  try {
    // Start listening for numDocsPromise resolution
    numDocsPromise.then(num => {
      numDocumentsPromiseResolved = true;
      numDocumentsValue = num;
    }).catch(err => {
      numDocumentsPromiseResolved = true;
      numDocumentsError = err;
    });

    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      // If numDocsPromise has resolved and not yet yielded, yield it first
      if (numDocumentsPromiseResolved && !numDocsYielded) {
        if (numDocumentsError) {
          yield { error: numDocumentsError };
        } else {
          yield { numDocs: numDocumentsValue };
        }
        numDocsYielded = true;
      }
      yield { document: doc.toJSON({ virtuals: false, getters: false, transform: false }) };
    }

    // If numDocsPromise hasn't resolved yet, wait for it and yield
    if (!numDocsYielded) {
      const numDocuments = await numDocsPromise;
      yield { numDocs: numDocuments };
    }
  } finally {
    await cursor.close();
  }
};
