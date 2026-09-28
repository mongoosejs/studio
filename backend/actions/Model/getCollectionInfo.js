'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const readOperationOptions = require('../../helpers/readOperationOptions');

const GetCollectionInfoParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  roles: {
    $type: ['string']
  },
  maxTimeMS: {
    $type: 'number'
  },
  readPreference: {
    $type: 'string',
    $enum: ['secondary', 'secondaryPreferred', 'primary']
  }
}).compile('GetCollectionInfoParams');

module.exports = ({ db, options }) => async function getCollectionInfo(params) {
  const { model, roles } = new GetCollectionInfoParams(params);

  await authorize('Model.getCollectionInfo', roles);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  const dbOptions = readOperationOptions(options, params);
  const [collectionOptions, stats] = await Promise.all([
    Model.collection.options(dbOptions),
    Model.aggregate([
      {
        $collStats: {
          storageStats: {},
          count: {}
        }
      }
    ]).option(dbOptions).then(res => res[0] ?? {})
  ]);

  return {
    info: {
      capped: !!stats.storageStats?.capped,
      size: stats.storageStats?.size,
      totalIndexSize: stats.storageStats?.totalIndexSize,
      indexCount: stats.storageStats?.nindexes,
      documentCount: stats.storageStats?.count,
      hasCollation: !!collectionOptions?.collation,
      collation: collectionOptions?.collation || null
    }
  };
};

module.exports.paramsType = GetCollectionInfoParams;
module.exports.tags = ['readOnly'];
