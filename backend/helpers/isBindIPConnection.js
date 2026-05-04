'use strict';

module.exports = function isBindIPConnection(req, bindIp) {
  if (bindIp == null) {
    return true;
  }
  return bindIp.includes(req.ip || '');
};
