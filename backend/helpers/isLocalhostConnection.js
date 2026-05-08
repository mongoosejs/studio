'use strict';

module.exports = function isLocalhostConnection(req) {
  const remoteAddress = req.ip || '';
  return remoteAddress === '127.0.0.1' ||
    remoteAddress === '::1' ||
    remoteAddress === '::ffff:127.0.0.1';
};
