'use strict';

const isBindIPConnection = require('../helpers/isBindIPConnection');
const isLocalhostConnection = require('../helpers/isLocalhostConnection');
const normalizeBindIPOption = require('../helpers/normalizeBindIPOption');

module.exports = function checkVercelBindIp(options) {
  const hasBindIpOption = options.bindIp != null;
  const bindIp = normalizeBindIPOption(options.bindIp);

  return function checkRequest(req, res) {
    if (options.apiKey || bindIp === null) {
      return true;
    }
    const ip = (process.env.VERCEL && req.headers['x-vercel-forwarded-for']) ||
      req.ip || req.socket?.remoteAddress || '';
    const allowed = hasBindIpOption
      ? isBindIPConnection({ ip }, bindIp)
      : isLocalhostConnection({ ip });
    if (!allowed) {
      res.status(403).json({ message: 'Mongoose Studio without an API key only accepts localhost or configured bindIp connections' });
    }
    return allowed;
  };
};
