'use strict';

const Backend = require('./');
const vercelMCP = require('./vercel/vercelMCP');
const checkVercelBindIp = require('./vercel/checkBindIp');
const { defaultMothershipURL } = require('../constants');

module.exports = function next(conn, options) {
  options = { ...options };
  options.mcp = options.mcp ?? !options.apiKey;
  const checkRequest = checkVercelBindIp(options);
  const backend = Backend(conn, options.studioConnection, options);
  const mcpHandlers = options.mcp ? vercelMCP(conn, options, backend) : null;

  const mothershipUrl = options._mothershipUrl || defaultMothershipURL;
  let workspace = null;

  return async function wrappedNextJSFunction(req, res) {
    if (!checkRequest(req, res)) {
      return;
    }

    const route = req.query?.studioRoute;
    if (route != null && (!Array.isArray(route) || route.length > 0)) {
      const routePath = Array.isArray(route) ? route.join('/') : null;
      if (routePath !== 'mcp' && routePath !== '.well-known/oauth-protected-resource') {
        return res.status(404).json({ message: 'Not found' });
      }
      if (!mcpHandlers) {
        return res.status(404).json({ message: 'Not found' });
      }
      return routePath === 'mcp'
        ? mcpHandlers.endpoint(req, res)
        : mcpHandlers.metadata(req, res);
    }

    const params = { ...req.query, ...req.body, ...req.params, authorization: req.headers.authorization };
    delete params.studioRoute;
    const actionName = params?.action;

    const authorization = params?.authorization;
    if (options.apiKey) {
      if (!authorization) {
        throw new Error('Not authorized');
      }

      if (workspace == null) {
        ({ workspace } = await fetch(`${mothershipUrl}/getWorkspace`, {
          method: 'POST',
          body: JSON.stringify({ apiKey: options.apiKey }),
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            'Content-Type': 'application/json'
          }
        })
          .then(response => {
            if (response.status < 200 || response.status >= 400) {
              return response.json().then(data => {
                throw new Error(`Error getting workspace ${response.status}: ${require('util').inspect(data)}`);
              });
            }
            return response;
          })
          .then(res => res.json()));
        options.workspace = workspace;
      }

      const { user, roles } = await fetch(`${mothershipUrl}/me?`, {
        method: 'POST',
        body: JSON.stringify({ workspaceId: workspace._id }),
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json'
        }
      })
        .then(response => {
          if (response.status < 200 || response.status >= 400) {
            return response.json().then(data => {
              throw new Error(`Mongoose Studio API Key Error ${response.status}: ${require('util').inspect(data)}`);
            });
          }
          return response;
        })
        .then(res => res.json());
      if (!user || !roles) {
        throw new Error('Not authorized');
      }

      params.$workspaceId = workspace._id;
      params.roles = roles;
      params.userId = user._id;
      params.initiatedById = user._id;
      params.initiatedBy = user;
    }

    if (typeof actionName !== 'string') {
      throw new Error('No action specified');
    }
    const pieces = actionName.split('.').filter(p => p !== '__proto__' && p !== 'contructor');
    let actionFn = backend;
    for (const piece of pieces) {
      if (actionFn == null) {
        throw new Error(`Action ${actionName} not found`);
      }
      actionFn = actionFn[piece];
    }
    if (typeof actionFn !== 'function') {
      throw new Error(`Action ${actionName} not found`);
    }

    return actionFn(params, req, res)
      .then(result => {
        if (typeof result === 'string') {
          res.status(200).send(result);
          return result;
        }
        res.status(200).json(result);
        return result;
      })
      .catch(error => res.status(500).json({ message: error.message }));
  };
};
