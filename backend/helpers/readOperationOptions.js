'use strict';

const operationOptions = require('./operationOptions');

const readPreferenceRank = {
  secondary: 0,
  secondaryPreferred: 1,
  primary: 2
};

/**
 * Options to apply to a read against the application database: everything
 * `operationOptions()` resolves, plus the read preference. MCP OAuth grants use
 * the read preference to keep AI clients off the primary, so like the query time
 * limit it is resolved to whichever of the configured and requested values is
 * more restrictive.
 */
module.exports = function readOperationOptions(options, params, extra) {
  return operationOptions(options, params, {
    ...extra,
    readPreference: resolveReadPreference(options, params)
  });
};

function resolveReadPreference(options, params) {
  const preferences = [options?.readPreference, params?.readPreference].
    filter(preference => readPreferenceRank[preference] != null);
  return preferences.length === 0 ?
    null :
    preferences.reduce((result, preference) => readPreferenceRank[preference] < readPreferenceRank[result] ? preference : result);
}
