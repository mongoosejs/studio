'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const omitNullish = require('../../helpers/omitNullish');

const GetEstimatedDocumentCountsParams = new Archetype({
  roles: {
    $type: ['string']
  }
}).compile('GetEstimatedDocumentCountsParams');

module.exports = ({ db, options }) => async function getEstimatedDocumentCounts(params) {
  const { roles } = new GetEstimatedDocumentCountsParams(params);
  await authorize('Model.getEstimatedDocumentCounts', roles);

  const modelNames = Object.keys(db.models)
    .filter(key => !key.startsWith('__Studio_'))
    .sort();

  const results = await Promise.allSettled(
    modelNames.map(name => {
      const Model = db.models[name];
      return Model.estimatedDocumentCount().
        setOptions(omitNullish({ maxTimeMS: options?.maxTimeMS })).
        exec();
    })
  );

  const counts = {};
  results.forEach((result, index) => {
    const name = modelNames[index];
    if (result.status === 'fulfilled' && typeof result.value === 'number') {
      counts[name] = result.value;
    } else {
      counts[name] = null;
    }
  });

  return { counts };
};
