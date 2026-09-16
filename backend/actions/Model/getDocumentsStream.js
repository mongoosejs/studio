'use strict';

const Archetype = require('archetype');
const removeSpecifiedPaths = require('../../helpers/removeSpecifiedPaths');
const evaluateFilter = require('../../helpers/evaluateFilter');
const getRefFromSchemaType = require('../../helpers/getRefFromSchemaType');
const getSuggestedProjection = require('../../helpers/getSuggestedProjection');
const parseProjectionParam = require('../../helpers/parseProjectionParam');
const authorize = require('../../authorize');
const omitNullish = require('../../helpers/omitNullish');

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
  projectionInput: {
    $type: 'string'
  },
  roles: {
    $type: ['string']
  }
}).compile('GetDocumentsParams');

module.exports = ({ db, options }) => async function* getDocumentsStream(params) {
  params = new GetDocumentsParams(params);
  const { roles } = params;
  await authorize('Model.getDocumentsStream', roles);

  const { model, limit, skip, sortKey, sortDirection, searchText, projectionInput } = params;

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

  let query = Model.find(filter).limit(limit).skip(skip).sort(sortObj).batchSize(1);
  const projection = parseProjectionParam({
    projectionInput,
    schemaPaths: Object.keys(Model.schema.paths)
  });
  if (projection != null) {
    query = query.select(projection);
  }
  query.setOptions(omitNullish({ maxTimeMS: options?.maxTimeMS }));

  const schemaPaths = {};
  for (const path of Object.keys(Model.schema.paths)) {
    const schemaType = Model.schema.paths[path];
    schemaPaths[path] = {
      instance: schemaType.instance,
      path,
      ref: getRefFromSchemaType(schemaType),
      required: schemaType.options?.required,
      enum: schemaType.options?.enum
    };
    if (schemaType.schema) {
      schemaPaths[path].schema = {};
      for (const subpath of Object.keys(schemaType.schema.paths)) {
        schemaPaths[path].schema[subpath] = {
          instance: schemaType.schema.paths[subpath].instance,
          path: subpath,
          ref: getRefFromSchemaType(schemaType.schema.paths[subpath]),
          required: schemaType.schema.paths[subpath].options?.required,
          enum: schemaType.schema.paths[subpath].options?.enum
        };
      }
    }
  }
  removeSpecifiedPaths(schemaPaths, '.$*');

  const suggestedFields = getSuggestedProjection(Model);

  yield { schemaPaths, suggestedFields };

  // Start counting documents in parallel with streaming documents
  const countQuery = (parsedFilter == null)
    ? Model.estimatedDocumentCount()
    : Model.countDocuments(filter);
  const numDocsPromise = countQuery.
    setOptions(omitNullish({ maxTimeMS: options?.maxTimeMS })).
    exec();

  let numDocsYielded = false;
  let numDocumentsPromiseResolved = false;
  let numDocumentsValue;
  let numDocumentsError;

  // Attach both handlers immediately so a fast count failure cannot become
  // an unhandled rejection while the document cursor is still opening.
  numDocsPromise.then(num => {
    numDocumentsPromiseResolved = true;
    numDocumentsValue = num;
  }).catch(err => {
    numDocumentsPromiseResolved = true;
    numDocumentsError = err;
  });

  const cursor = await query.cursor();

  try {
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      // If numDocsPromise has resolved and not yet yielded, yield it first
      if (numDocumentsPromiseResolved && !numDocsYielded) {
        if (numDocumentsError) {
          yield { numDocsError: numDocumentsError.message };
        } else {
          yield { numDocs: numDocumentsValue };
        }
        numDocsYielded = true;
      }
      yield { document: doc.toJSON({ virtuals: false, getters: false, transform: false }) };
    }

    // If numDocsPromise hasn't resolved yet, wait for it and yield
    if (!numDocsYielded) {
      try {
        const numDocuments = await numDocsPromise;
        yield { numDocs: numDocuments };
      } catch (err) {
        yield { numDocsError: err.message };
      }
    }
  } finally {
    await cursor.close();
  }
};
