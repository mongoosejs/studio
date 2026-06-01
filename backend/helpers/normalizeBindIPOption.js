'use strict';

module.exports = function normalizeBindIPOption(bindIp) {
  if (bindIp === null) {
    return null;
  }
  if (bindIp === undefined) {
    return ['localhost'];
  }

  const bindIps = Array.isArray(bindIp) ? bindIp : `${bindIp}`.split(',');
  return bindIps.
    flatMap(bindIp => `${bindIp}`.split(',')).
    map(bindIp => bindIp.trim()).
    filter(bindIp => bindIp.length > 0);
};
