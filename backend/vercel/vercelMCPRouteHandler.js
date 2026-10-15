'use strict';

const Backend = require('../');
const checkVercelBindIp = require('./checkBindIp');
const vercelMCP = require('./vercelMCP');

module.exports = function vercelMCPRouteHandler(conn, options) {
  options = { ...options, mcp: true, _mcpPath: '/api/studio-mcp' };
  const checkRequest = checkVercelBindIp(options);
  const backend = Backend(conn, options.studioConnection, options);
  const { endpoint } = vercelMCP(conn, options, backend);

  return function wrappedVercelMCPRouteHandler(req, res) {
    if (!checkRequest(req, res)) {
      return;
    }
    return endpoint(req, res);
  };
};
