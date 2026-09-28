'use strict';

const Backend = require('./backend');
const express = require('express');
const frontend = require('./frontend');
const mcp = require('./backend/mcp');
const mcpOAuthResource = require('./backend/mcpOAuthResource');
const isBindIPConnection = require('./backend/helpers/isBindIPConnection');
const isLocalhostConnection = require('./backend/helpers/isLocalhostConnection');
const normalizeBindIPOption = require('./backend/helpers/normalizeBindIPOption');
const { toRoute, objectRouter } = require('extrovert');
const { defaultMothershipURL } = require('./constants');

const jsonParser = express.json();

module.exports = async function mongooseStudioExpressApp(apiUrl, conn, options) {
  const router = express.Router();
  options = options ? { changeStream: true, ...options } : { changeStream: true };
  const hasBindIpOption = Object.prototype.hasOwnProperty.call(options, 'bindIp');
  const bindIp = normalizeBindIPOption(options.bindIp);

  const mothershipUrl = options._mothershipUrl || defaultMothershipURL;
  let workspace = null;
  if (options?.apiKey) {
    ({ workspace } = await fetch(`${mothershipUrl}/getWorkspace`, {
      method: 'POST',
      body: JSON.stringify({ apiKey: options.apiKey }),
      headers: {
        'Authorization': `Bearer ${options.apiKey}`,
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
      .then(res => res.json()));
  }

  if (!workspace && bindIp !== null) {
    router.use((req, res, next) => {
      const allowed = hasBindIpOption ? isBindIPConnection(req, bindIp) : isLocalhostConnection(req);
      if (!allowed) {
        return res.status(403).json({ message: 'Mongoose Studio without an API key only accepts localhost or configured bindIp connections' });
      }

      next();
    });
  }

  apiUrl = apiUrl || 'api';
  const backend = Backend(conn, options.studioConnection, options);
  delete backend.services;

  function authorizeRequest(req, res, next) {
    if (!workspace) {
      next();
      return;
    }
    const authorizationHeader = req.headers.authorization;
    if (!authorizationHeader) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      return res.status(401).json({ message: 'Not authorized' });
    }
    const authorization = authorizationHeader.replace(/^Bearer\s+/i, '');
    const params = {
      method: 'POST',
      body: JSON.stringify({ workspaceId: workspace._id }),
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json'
      }
    };
    fetch(`${mothershipUrl}/me`, params)
      .then(response => {
        if (response.status < 200 || response.status >= 400) {
          return response.json().then(data => {
            throw new Error(`Mongoose Studio API Key Error ${response.status}: ${require('util').inspect(data)}`);
          });
        }
        return response;
      })
      .then(res => res.json())
      .then(({ user, roles }) => {
        if (!user || !roles) {
          return res.status(403).json({ message: 'Not authorized' });
        }
        req._internals = req._internals || {};
        req._internals.authorization = authorization;
        req._internals.initiatedById = user._id;
        req._internals.roles = roles;
        req._internals.$workspaceId = workspace._id;
        req._internals.initiatedBy = user;

        next();
      })
      .catch(err => {
        return res.status(500).json({ message: err.message });
      });
  }

  router.use(
    '/api',
    authorizeRequest,
    function parseJson(req, res, next) {
      if (req.body !== undefined || req.readable === false) {
        return next();
      }
      return jsonParser(req, res, next);
    },
    objectRouter(backend, toRoute)
  );

  // MCP clients (ChatGPT, Claude, ...) authenticate with OAuth access tokens
  // issued by the mothership. Studio is the protected resource: it publishes the
  // metadata that points clients at the authorization server, and resolves each
  // token to its current grant before handling the request.
  const mcpResource = workspace ?
    mcpOAuthResource({
      mothershipUrl,
      apiKey: options.apiKey,
      publicUrl: options.publicUrl,
      authorizationServerUrl: options.authorizationServerUrl,
      oauthUrl: options._mcpOAuthUrl
    }) :
    null;

  function serveProtectedResourceMetadata(req, res, next) {
    if (!mcpResource) {
      return res.status(404).json({ message: 'Mongoose Studio MCP OAuth requires an API key' });
    }
    mcpResource.metadataFor(req).
      then(metadata => {
        res.setHeader('Cache-Control', 'no-store');
        res.json(metadata);
      }).
      catch(next);
  }

  // Browser based MCP clients discover and connect cross-origin, so both the
  // metadata and the MCP endpoint itself need CORS, including a preflight.
  router.use('/.well-known/oauth-protected-resource', mcpOAuthResource.cors);
  router.get('/.well-known/oauth-protected-resource', serveProtectedResourceMetadata);
  router.get('/.well-known/oauth-protected-resource/mcp', serveProtectedResourceMetadata);

  function authorizeMCPRequest(req, res, next) {
    if (!mcpResource) {
      return authorizeRequest(req, res, next);
    }
    const token = `${req.headers.authorization || ''}`.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      res.setHeader('WWW-Authenticate', mcpResource.challenge(req));
      return res.status(401).json({ message: 'Not authorized' });
    }
    if (!mcpResource.isMCPAccessToken(token)) {
      // A Studio session token, for example the Studio UI talking to its own
      // MCP endpoint. Fall back to the regular Studio authorization path.
      return authorizeRequest(req, res, next);
    }

    mcpResource.introspect(req, token).
      then(({ user, permissions }) => {
        req._internals = req._internals || {};
        req._internals.authorization = token;
        req._internals.initiatedById = user._id;
        req._internals.roles = permissions.roles;
        req._internals.$workspaceId = workspace._id;
        req._internals.initiatedBy = user;
        // The limits from the grant, applied to every operation this request
        // runs. `maxTimeMS` is still capped by the host application's own
        // `maxTimeMS` option, and a read preference can only be narrowed.
        req._internals.maxTimeMS = permissions.maxTimeMS;
        req._internals.readPreference = permissions.readPreference;

        next();
      }).
      catch(err => {
        if (err.status === 401) {
          res.setHeader('WWW-Authenticate', mcpResource.challenge(req, { error: 'invalid_token', description: err.message }));
          return res.status(401).json({ message: err.message });
        }
        return res.status(500).json({ message: err.message });
      });
  }

  router.use('/mcp', mcpOAuthResource.cors, authorizeMCPRequest, jsonParser, mcp(backend));

  const { config } = await frontend(apiUrl, false, options, workspace);
  config.enableTaskVisualizer = options.enableTaskVisualizer;
  router.get('/config.js', function (req, res) {
    res.setHeader('Content-Type', 'application/javascript');
    res.end(`window.MONGOOSE_STUDIO_CONFIG = ${JSON.stringify(config, null, 2)};`);
  });

  router.use(express.static(`${__dirname}/frontend/public`));

  if (workspace) {
    console.log(`✔️  Mongoose Studio connected to workspace "${workspace.name}"`);
  }

  return router;
}
