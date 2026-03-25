'use strict';

/** Max number of paths to use for the default table projection. */
const DEFAULT_SUGGESTED_LIMIT = 6;

/**
 * Default projection for the models table: the first N schema paths (definition order),
 * excluding Mongoose internals. No scoring — stable and predictable.
 *
 * @param {import('mongoose').Model} Model - Mongoose model
 * @param {{ limit?: number }} options - max paths returned
 * @returns {string[]} Path names in schema order
 */
function getSuggestedProjection(Model, options = {}) {
  const limit = typeof options.limit === 'number' && options.limit > 0
    ? options.limit
    : DEFAULT_SUGGESTED_LIMIT;

  const pathNames = Object.keys(Model.schema.paths).filter(key =>
    !key.includes('.$*') &&
    key !== '__v'
  );

  pathNames.sort((k1, k2) => {
    if (k1 === '_id' && k2 !== '_id') {
      return -1;
    }
    if (k1 !== '_id' && k2 === '_id') {
      return 1;
    }
    return 0;
  });

  return pathNames.slice(0, limit);
}

module.exports = getSuggestedProjection;
