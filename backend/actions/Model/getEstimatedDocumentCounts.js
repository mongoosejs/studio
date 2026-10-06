'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const readOperationOptions = require('../../helpers/readOperationOptions');

const GetEstimatedDocumentCountsParams = new Archetype({
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
        setOptions(readOperationOptions(options, params)).
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

module.exports.paramsType = GetEstimatedDocumentCountsParams;
module.exports.tags = ['readOnly'];
