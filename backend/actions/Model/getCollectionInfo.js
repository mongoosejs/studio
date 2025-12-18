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
    Model.collection.stats()
  ]);

  return {
    info: {
      capped: !!collectionOptions?.capped,
      size: stats?.size,
      totalIndexSize: stats?.totalIndexSize,
      indexCount: stats?.nindexes,
      documentCount: stats?.count,
      hasCollation: !!collectionOptions?.collation,
      collation: collectionOptions?.collation || null
    }
  };
};
