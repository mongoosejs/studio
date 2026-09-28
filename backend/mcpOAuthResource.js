'use strict';

const ACCESS_TOKEN_PREFIX = 'mcp_at_';

/**
 * The OAuth 2.1 protected resource half of Mongoose Studio's MCP support.
 *
 * Studio never issues or stores MCP OAuth tokens: the mothership is the
 * authorization server. Studio's job is to publish protected resource metadata
 * (RFC 9728) so MCP clients can discover that authorization server, and to
 * resolve every incoming access token to its current effective authorization
 * before running anything.
 */
module.exports = function mcpOAuthResource({ mothershipUrl, apiKey, publicUrl, authorizationServerUrl, oauthUrl }) {
  const registeredResources = new Set();
  // The mothership URL points at its action endpoints; MCP OAuth lives in its
  // own namespace on the same host.
  const mcpOAuthUrl = oauthUrl || `${new URL(mothershipUrl).origin}/mcp-oauth`;

  // The authorization server's issuer identifier, which MCP clients use to find
  // it. An explicitly configured value wins; otherwise the authorization server
  // reports its own issuer when Studio registers, which keeps the two from
  // drifting apart. Deriving it from the mothership URL is the last resort, and
  // is correct for the default hosted mothership.
  let issuer = authorizationServerUrl ? stripTrailingSlash(authorizationServerUrl) : null;

  /**
   * The RFC 8707 resource identifier for this deployment's MCP endpoint. Studio
   * is mounted by the host application, so prefer the configured public URL and
   * fall back to what the proxy tells us about the current request.
   */
  function resourceFor(req) {
    if (publicUrl) {
      return canonicalize(`${publicUrl.replace(/\/+$/, '')}/mcp`);
    }
    const protocol = firstHeaderValue(req.headers['x-forwarded-proto']) || req.protocol || 'http';
    const host = firstHeaderValue(req.headers['x-forwarded-host']) || req.headers.host;
    const mountPath = `${req.baseUrl || ''}`.replace(/\/mcp$/, '');
    return canonicalize(`${protocol}://${host}${mountPath}/mcp`);
  }

  async function metadataFor(req) {
    const resource = resourceFor(req);
    // Registration is what teaches the authorization server which workspace this
    // URL belongs to, and it answers with the issuer, so wait for it here rather
    // than advertising a guess.
    await register(resource);
    return {
      resource,
      authorization_servers: [issuer ?? new URL(mothershipUrl).origin],
      scopes_supported: ['mcp'],
      bearer_methods_supported: ['header'],
      resource_documentation: 'https://mongoosestudio.app/docs/'
    };
  }

  /**
   * RFC 9728 challenge. MCP clients read `resource_metadata` from this header to
   * find the metadata document, which matters because Studio is usually mounted
   * on a subpath where the host-root well-known URL is not Studio's to serve.
   */
  function challenge(req, { error, description } = {}) {
    // A client that already knows this server may go straight to the
    // authorization server, so make sure the resource is registered even if the
    // client never asks Studio for its metadata.
    register(resourceFor(req)).catch(() => {});
    const metadataUrl = `${resourceFor(req).replace(/\/mcp$/, '')}/.well-known/oauth-protected-resource`;
    const parts = [`Bearer resource_metadata="${metadataUrl}"`];
    if (error) {
      parts.push(`error="${error}"`);
    }
    if (description) {
      parts.push(`error_description="${`${description}`.replace(/"/g, '')}"`);
    }
    return parts.join(', ');
  }

  function isMCPAccessToken(token) {
    return typeof token === 'string' && token.startsWith(ACCESS_TOKEN_PREFIX);
  }

  /**
   * Ask the authorization server who this token belongs to and what it may do
   * right now. This runs on every MCP request on purpose: grants are mutable and
   * revocable, so the token is only a pointer to the current policy.
   */
  async function introspect(req, token) {
    const response = await fetch(`${mcpOAuthUrl}/MCPOAuthToken/introspectMCPAccessToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, token, resource: resourceFor(req) })
    });
    const data = await response.json().catch(() => ({}));
    if (response.status < 200 || response.status >= 400) {
      const error = new Error(data?.message || 'MCP access token is not valid');
      // Anything other than an explicit rejection is the authorization server
      // being unreachable or broken, which is not the client's fault.
      error.status = response.status === 401 || response.status === 403 ? 401 : 502;
      throw error;
    }
    return data;
  }

  // Announce this deployment's MCP URL so the authorization server can map the
  // `resource` an MCP client sends back to this workspace.
  async function register(resource) {
    if (registeredResources.has(resource)) {
      return;
    }
    try {
      const response = await fetch(`${mcpOAuthUrl}/Workspace/registerMCPResource`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, resource })
      });
      const data = await response.json().catch(() => ({}));
      if (response.status < 200 || response.status >= 400) {
        throw new Error(data?.message || `status ${response.status}`);
      }
      registeredResources.add(resource);
      if (authorizationServerUrl == null && data.issuer) {
        issuer = stripTrailingSlash(data.issuer);
      }
    } catch (err) {
      // Not fatal: metadata is still worth serving, and the next request retries.
      console.warn(`[MONGOOSE STUDIO] Could not register MCP resource ${resource}: ${err.message}`);
    }
  }

  return { resourceFor, metadataFor, challenge, isMCPAccessToken, introspect, register };
};

/**
 * Browser based MCP clients, such as claude.ai, run discovery from the page, so
 * the MCP endpoint and its metadata have to be reachable cross-origin.
 *
 * `Access-Control-Expose-Headers` is the one that matters most: without it the
 * browser hides `WWW-Authenticate` from the client, so the client never learns
 * where the protected resource metadata lives and cannot start the sign-in flow.
 * Bearer tokens travel in a header rather than a cookie, so a wildcard origin is
 * safe here: there are no credentials for a browser to attach automatically.
 */
module.exports.cors = function cors(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID');
  res.setHeader('Access-Control-Expose-Headers', 'WWW-Authenticate, Mcp-Session-Id, Mcp-Protocol-Version');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
};

function canonicalize(resource) {
  const url = new URL(resource);
  url.hash = '';
  url.search = '';
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }
  return url.toString();
}

function stripTrailingSlash(url) {
  return `${url}`.replace(/\/+$/, '');
}

function firstHeaderValue(value) {
  if (value == null) {
    return null;
  }
  return `${value}`.split(',')[0].trim() || null;
}

module.exports.ACCESS_TOKEN_PREFIX = ACCESS_TOKEN_PREFIX;
