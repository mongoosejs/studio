'use strict';

const omitNullish = require('./omitNullish');

/**
 * Options to apply to a MongoDB operation: the configured query time limit,
 * narrowed by any limit the request itself carries.
 *
 * Per-request limits arrive as params, which trusted middleware sets from the
 * caller's authorization: an MCP OAuth grant, for example, caps every operation
 * the AI client runs. They are intersected with the host application's
 * configuration rather than replacing it, so a request can only ever ask for
 * less than the host allows, never more.
 */
module.exports = function operationOptions(options, params, extra) {
  return omitNullish({ ...extra, maxTimeMS: resolveMaxTimeMS(options, params) });
};

module.exports.resolveMaxTimeMS = resolveMaxTimeMS;

function resolveMaxTimeMS(options, params) {
  const requested = Number(params?.maxTimeMS);
  const limits = [options?.maxTimeMS, Number.isFinite(requested) && requested > 0 ? requested : null].
    filter(limit => limit != null);
  return limits.length === 0 ? null : Math.min(...limits);
}
