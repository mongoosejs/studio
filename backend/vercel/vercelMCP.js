'use strict';

const Backend = require('../');
const mcp = require('../mcp');
const mothership = require('../integrations/mothership');
const vercelMCPConfig = require('./mcpConfig');
const { defaultMothershipURL } = require('../../constants');

module.exports = function createVercelMCPHandlers(conn, options, existingBackend) {
  if (options.mcp !== true) {
    throw new Error('Mongoose Studio requires mcp: true for the Vercel MCP handler');
  }
  const config = options.apiKey ? vercelMCPConfig(options) : null;
  const { resource, metadataUrl } = config || {};
  const mothershipUrl = options._mothershipUrl || defaultMothershipURL;
  const backend = existingBackend || Backend(conn, options.studioConnection, options);
  let workspacePromise;
  let registered = false;

  async function workspace() {
    if (!workspacePromise) {
      workspacePromise = fetch(`${mothershipUrl}/getWorkspace`, {
        method: 'POST',
        body: JSON.stringify({ apiKey: options.apiKey }),
        headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' }
      }).then(async response => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || `Mongoose Studio API Key Error ${response.status}`);
        }
        options.workspace = data.workspace;
        return data.workspace;
      }).catch(err => {
        workspacePromise = null;
        throw err;
      });
    }
    return workspacePromise;
  }

  async function registerResource() {
    if (registered) {
      return;
    }
    try {
      await mothership.Workspace.registerMCPResource({ apiKey: options.apiKey, resource }, options);
      registered = true;
    } catch (err) {
      console.warn(`[MONGOOSE STUDIO] Could not register MCP resource ${resource}: ${err.message}`);
    }
  }

  function challenge(res, error) {
    const detail = error ? `, error="invalid_token", error_description="${error.replace(/"/g, '')}"` : '';
    res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${metadataUrl}"${detail}`);
  }

  function cors(req, res) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID');
    res.setHeader('Access-Control-Expose-Headers', 'WWW-Authenticate, Mcp-Session-Id, Mcp-Protocol-Version');
    res.setHeader('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return true;
    }
    return false;
  }

  async function metadata(req, res) {
    if (!options.apiKey) {
      return res.status(404).json({ message: 'Not found' });
    }
    if (cors(req, res)) {
      return;
    }
    if (req.method !== 'GET') {
      return res.status(405).end();
    }
    try {
      await workspace();
      await registerResource();
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(config.metadata);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  }

  async function endpoint(req, res) {
    if (cors(req, res)) {
      return;
    }
    if (!options.apiKey) {
      return mcp(backend)(req, res);
    }
    try {
      const currentWorkspace = await workspace();
      const token = `${req.headers.authorization || ''}`.replace(/^Bearer\s+/i, '').trim();
      if (!token) {
        await registerResource();
        challenge(res);
        return res.status(401).json({ message: 'Not authorized' });
      }

      let user;
      let roles;
      const context = { $workspaceId: currentWorkspace._id };
      if (token.startsWith('mcp_at_')) {
        const result = await mothership.MCPOAuthToken.introspectMCPAccessToken({
          apiKey: options.apiKey, token, resource
        }, options);
        user = result.user;
        roles = result.permissions.roles;
        context.maxTimeMS = result.permissions.maxTimeMS;
        context.readPreference = result.permissions.readPreference;
      } else {
        const response = await fetch(`${mothershipUrl}/me`, {
          method: 'POST',
          body: JSON.stringify({ workspaceId: currentWorkspace._id }),
          headers: { Authorization: token, 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
          return res.status(response.status).json({ message: 'Not authorized' });
        }
        ({ user, roles } = await response.json());
      }
      if (!user || !roles) {
        return res.status(403).json({ message: 'Not authorized' });
      }
      req._internals = {
        ...context,
        authorization: token,
        initiatedById: user._id,
        initiatedBy: user,
        userId: user._id,
        roles
      };
      return mcp(backend)(req, res);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        challenge(res, err.message);
        return res.status(401).json({ message: err.message });
      }
      return res.status(500).json({ message: err.message });
    }
  }

  return { endpoint, metadata };
};
