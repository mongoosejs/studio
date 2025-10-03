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
  sort: {
    $type: Archetype.Any
  },
  roles: {
    $type: ['string']
  }
}).compile('GetDocumentsParams');

module.exports = ({ db }) => async function* getDocumentsStream(params) {
  params = new GetDocumentsParams(params);
  const { roles } = params;
  await authorize('Model.getDocumentsStream', roles);

  const { model, limit, skip, sort, searchText } = params;

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  const parsedFilter = evaluateFilter(searchText);
  const filter = parsedFilter == null ? {} : parsedFilter;

  const hasSort = typeof sort === 'object' && sort != null && Object.keys(sort).length > 0;
  const sortObj = hasSort ? { ...sort } : {};
  if (!sortObj.hasOwnProperty('_id')) {
    sortObj._id = -1;
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
