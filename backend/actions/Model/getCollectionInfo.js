'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

const GetCollectionInfoParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  roles: {
    $type: ['string']
  }
}).compile('GetCollectionInfoParams');

module.exports = ({ db }) => async function getCollectionInfo(params) {
  const { model, roles } = new GetCollectionInfoParams(params);

  await authorize('Model.getCollectionInfo', roles);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  const [collectionOptions, stats] = await Promise.all([
    Model.collection.options(),
    Model.aggregate([
      {
        $collStats: {
          storageStats: {},
          count: {}
        }
      }
    ]).then(res => res[0] ?? {})
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
