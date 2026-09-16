'use strict';

module.exports = function omitNullish(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value != null));
};
