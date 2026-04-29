'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

const AggregateParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  pipeline: {
    $type: Archetype.Any,
    $required: true
  },
  limit: {
    $type: 'number',
    $default: 20
  },
  roles: {
    $type: ['string']
  }
}).compile('AggregateParams');

module.exports = ({ db }) => async function aggregate(params) {
  params = new AggregateParams(params);
  const { model, roles } = params;
  await authorize('Model.aggregate', roles);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  if (!Array.isArray(params.pipeline)) {
    throw new Error('`pipeline` must be an array');
  }

  const pipeline = params.pipeline.map((stage, index) => {
    if (stage == null || Array.isArray(stage) || typeof stage !== 'object') {
      throw new Error(`Invalid stage at index ${index}`);
    }
    return stage;
  });

  const limit = Math.max(1, Math.min(200, Math.floor(params.limit || 20)));
  pipeline.push({ $limit: limit });

  const docs = await Model.aggregate(pipeline).exec();
  return { docs };
};
