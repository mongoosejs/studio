'use strict';

const assert = require('assert');
const express = require('express');
const studio = require('../express');
const { connection } = require('./setup.test');

const API_KEY = 'test-api-key';
const ISSUER = 'https://mothership.example.com';
const WORKSPACE = { _id: '0123456789abcdef01234567', name: 'Test Workspace', baseUrl: 'https://app.example.com/studio' };
const USER = { _id: '0123456789abcdef01234568', name: 'Test User', email: 'test@example.com' };

describe('MCP OAuth protected resource', function() {
  let mothership;
  let mothershipRequests;
  let introspectResponse;
  let server;
  let baseUrl;

  before(async function() {
    // Stand in for the mothership: Studio is the protected resource, so all it
    // does is ask the authorization server about incoming access tokens.
    const mothershipApp = express();
    mothershipApp.use(express.json());
    mothershipApp.post('/getWorkspace', (req, res) => res.json({ workspace: { ...WORKSPACE, apiKey: API_KEY } }));
    mothershipApp.post('/mcp-oauth/Workspace/registerMCPResource', (req, res) => {
      mothershipRequests.push(['registerMCPResource', req.body]);
      res.json({ resource: req.body.resource, issuer: ISSUER });
    });
    mothershipApp.post('/mcp-oauth/MCPOAuthToken/introspectMCPAccessToken', (req, res) => {
      mothershipRequests.push(['introspectMCPAccessToken', req.body]);
      if (introspectResponse.status !== 200) {
        return res.status(introspectResponse.status).json(introspectResponse.body);
      }
      res.json(introspectResponse.body);
    });
    mothershipApp.post('/me', (req, res) => res.json({ user: null, roles: null }));
    await new Promise(resolve => {
      mothership = mothershipApp.listen(0, '127.0.0.1', resolve);
    });

    const app = express();
    app.use('/studio', await studio('/studio/api', connection, {
      apiKey: API_KEY,
      changeStream: false,
      _mothershipUrl: `http://127.0.0.1:${mothership.address().port}`
    }));
    await new Promise(resolve => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async function() {
    // `fetch` keeps connections alive, and `close()` waits for them, so drop
    // them explicitly or the test process hangs on exit.
    server.closeAllConnections();
    mothership.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await new Promise(resolve => mothership.close(resolve));
  });

  beforeEach(function() {
    mothershipRequests = [];
    introspectResponse = {
      status: 200,
      body: {
        active: true,
        user: USER,
        workspaceId: WORKSPACE._id,
        grantId: '0123456789abcdef01234569',
        clientId: 'mcp_client_test',
        clientName: 'Claude',
        permissions: {
          read: true,
          write: false,
          readPreference: 'secondary',
          maxTimeMS: 5000,
          collections: '*',
          roles: ['readonly']
        }
      }
    };
  });

  async function waitForRequest(name) {
    for (let i = 0; i < 50; ++i) {
      const request = mothershipRequests.find(([requestName]) => requestName === name);
      if (request) {
        return request[1];
      }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error(`Timed out waiting for a ${name} request`);
  }

  it('publishes protected resource metadata pointing at the authorization server', async function() {
    const res = await fetch(`${baseUrl}/studio/.well-known/oauth-protected-resource`);
    const metadata = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(metadata.resource, `${baseUrl}/studio/mcp`);
    // The authorization server reported its own issuer when Studio registered,
    // which is not the URL Studio talks to it on.
    assert.deepStrictEqual(metadata.authorization_servers, [ISSUER]);
    assert.deepStrictEqual(metadata.scopes_supported, ['mcp']);

    // Studio announces its MCP URL, so the authorization server can map the
    // OAuth `resource` back to this workspace.
    const registration = await waitForRequest('registerMCPResource');
    assert.deepStrictEqual(registration, { apiKey: API_KEY, resource: `${baseUrl}/studio/mcp` });
  });

  it('publishes the workspace MCP URL to the frontend', async function() {
    const res = await fetch(`${baseUrl}/studio/config.js`);
    const source = await res.text();
    const config = JSON.parse(source.match(/window\.MONGOOSE_STUDIO_CONFIG = ([\s\S]+);$/)[1]);

    assert.strictEqual(config.mcp, true);
    assert.strictEqual(config.mcpUrl, 'https://app.example.com/studio/mcp');
  });

  it('lets a browser based client read the challenge cross-origin', async function() {
    const res = await fetch(`${baseUrl}/studio/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://claude.ai' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.headers.get('access-control-allow-origin'), 'https://claude.ai');
    // Without this the browser hides the challenge and the client cannot find
    // the authorization server.
    assert.ok(res.headers.get('access-control-expose-headers').includes('WWW-Authenticate'));
  });

  it('answers a CORS preflight for the MCP endpoint and its metadata', async function() {
    for (const path of ['/studio/mcp', '/studio/.well-known/oauth-protected-resource']) {
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://claude.ai',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization, content-type'
        }
      });

      assert.strictEqual(res.status, 204, path);
      assert.strictEqual(res.headers.get('access-control-allow-origin'), 'https://claude.ai', path);
      assert.ok(res.headers.get('access-control-allow-headers').toLowerCase().includes('authorization'), path);
    }
  });

  it('serves metadata cross-origin', async function() {
    const res = await fetch(`${baseUrl}/studio/.well-known/oauth-protected-resource`, {
      headers: { Origin: 'https://claude.ai' }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('access-control-allow-origin'), 'https://claude.ai');
  });

  it('challenges unauthenticated MCP requests with the metadata URL', async function() {
    const res = await fetch(`${baseUrl}/studio/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(
      res.headers.get('www-authenticate'),
      `Bearer resource_metadata="${baseUrl}/studio/.well-known/oauth-protected-resource"`
    );
  });

  it('rejects an access token the authorization server does not accept', async function() {
    introspectResponse = { status: 401, body: { message: 'Access token is invalid, expired, or revoked' } };
    const res = await fetch(`${baseUrl}/studio/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer mcp_at_revoked' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    });

    assert.strictEqual(res.status, 401);
    assert.ok(res.headers.get('www-authenticate').includes('error="invalid_token"'));
    assert.strictEqual(mothershipRequests[0][0], 'introspectMCPAccessToken');
  });

  it('resolves the grant on every request and only exposes authorized tools', async function() {
    const res = await fetch(`${baseUrl}/studio/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: 'Bearer mcp_at_valid'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      })
    });
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    const toolNames = body.result.tools.map(tool => tool.name);
    assert.ok(toolNames.includes('Model.getDocuments'));
    assert.ok(!toolNames.includes('Model.updateDocuments'));

    const introspect = mothershipRequests.find(([name]) => name === 'introspectMCPAccessToken');
    assert.deepStrictEqual(introspect[1], {
      apiKey: API_KEY,
      token: 'mcp_at_valid',
      resource: `${baseUrl}/studio/mcp`
    });
  });
});

describe('MCP disabled', function() {
  let server;
  let baseUrl;

  before(async function() {
    const app = express();
    // No API key, so this also covers the localhost mode where the MCP endpoint
    // would otherwise be served without OAuth.
    app.use('/studio', await studio('/studio/api', connection, {
      changeStream: false,
      mcp: false
    }));
    await new Promise(resolve => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async function() {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });

  it('does not serve the MCP endpoint', async function() {
    const res = await fetch(`${baseUrl}/studio/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    });

    assert.strictEqual(res.status, 404);
  });

  it('does not publish protected resource metadata', async function() {
    const res = await fetch(`${baseUrl}/studio/.well-known/oauth-protected-resource`);

    assert.strictEqual(res.status, 404);
  });

  it('disables MCP in the frontend config', async function() {
    const res = await fetch(`${baseUrl}/studio/config.js`);
    const source = await res.text();
    const config = JSON.parse(source.match(/window\.MONGOOSE_STUDIO_CONFIG = ([\s\S]+);$/)[1]);

    assert.strictEqual(config.mcp, false);
    assert.strictEqual(config.mcpUrl, null);
  });

  it('still serves the Studio API', async function() {
    const res = await fetch(`${baseUrl}/studio/api/status`, { method: 'POST' });

    assert.notStrictEqual(res.status, 404);
  });
});
