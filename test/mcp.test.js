'use strict';

const assert = require('assert');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const express = require('express');
const { applySpec } = require('extrovert');

const Actions = require('../backend/actions');
const authorize = require('../backend/authorize');
const mcp = require('../backend/mcp');

describe('MCP', function() {
  let httpServer;
  let client;
  let receivedParams;

  // Each test decides who is calling, because the tools a request can see and
  // the limits it runs under both come from the request's authorization.
  async function connect({ roles, limits }) {
    const app = express();
    const backend = applySpec({ Dashboard: Actions.Dashboard, Model: Actions.Model }, {});
    backend.Dashboard.getDashboards = Object.assign(async params => {
      receivedParams = params;
      return { dashboards: [{ title: 'Test dashboard' }] };
    }, Actions.Dashboard.getDashboards);
    backend.Model.listModels = Object.assign(async() => ({ models: ['User'] }), Actions.Model.listModels);

    app.use(express.json());
    app.use('/mcp', (req, res, next) => {
      req._internals = {
        authorization: 'access-token',
        initiatedById: '0123456789abcdef01234567',
        roles,
        userId: '0123456789abcdef01234567',
        ...limits
      };
      next();
    }, mcp(backend));

    await new Promise(resolve => {
      httpServer = app.listen(0, '127.0.0.1', resolve);
    });
    const { port } = httpServer.address();
    client = new Client({ name: 'mongoose-studio-test', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
  }

  function authorizedTools(roles) {
    return ['Dashboard', 'Model'].flatMap(namespace =>
      Object.keys(Actions[namespace]).map(action => `${namespace}.${action}`)
    ).filter(action => {
      try {
        authorize(action, roles);
        return true;
      } catch (err) {
        return false;
      }
    }).sort();
  }

  beforeEach(function() {
    receivedParams = undefined;
  });

  afterEach(async function() {
    await client.close();
    await new Promise(resolve => httpServer.close(resolve));
  });

  it('exposes Dashboard and Model actions as tools', async function() {
    await connect({ roles: ['owner'] });
    const { tools } = await client.listTools();
    assert.deepStrictEqual(tools.map(tool => tool.name).sort(), authorizedTools(['owner']));

    const deleteDashboard = tools.find(tool => tool.name === 'Dashboard.deleteDashboard');
    assert.strictEqual(deleteDashboard.annotations.destructiveHint, true);
    assert.strictEqual(deleteDashboard.annotations.readOnlyHint, false);
    const getDashboards = tools.find(tool => tool.name === 'Dashboard.getDashboards');
    assert.strictEqual(getDashboards.annotations.readOnlyHint, true);

    const getDocuments = tools.find(tool => tool.name === 'Model.getDocuments');
    assert.ok(!Object.hasOwn(getDocuments.inputSchema.properties, 'roles'));
    assert.deepStrictEqual(getDocuments.inputSchema.required, ['model']);
    assert.strictEqual(getDocuments.inputSchema.properties.limit.default, 20);
  });

  it('only exposes tools the request is authorized to call', async function() {
    await connect({ roles: ['readonly'] });
    const { tools } = await client.listTools();
    const toolNames = tools.map(tool => tool.name).sort();

    assert.deepStrictEqual(toolNames, authorizedTools(['readonly']));
    assert.ok(toolNames.includes('Model.getDocuments'));
    assert.ok(!toolNames.includes('Model.updateDocuments'));
    assert.ok(!toolNames.includes('Model.dropCollection'));
    assert.ok(!toolNames.includes('Dashboard.deleteDashboard'));
  });

  it('passes the limits from an OAuth grant to actions', async function() {
    await connect({ roles: ['readonly'], limits: { maxTimeMS: 5000, readPreference: 'secondary' } });
    await client.callTool({ name: 'Dashboard.getDashboards', arguments: {} });

    assert.strictEqual(receivedParams.maxTimeMS, 5000);
    assert.strictEqual(receivedParams.readPreference, 'secondary');
  });

  it('does not let an MCP client name the limits itself', async function() {
    await connect({ roles: ['readonly'], limits: { maxTimeMS: 5000, readPreference: 'secondary' } });
    const { tools } = await client.listTools();

    const getDocuments = tools.find(tool => tool.name === 'Model.getDocuments');
    assert.ok(!Object.hasOwn(getDocuments.inputSchema.properties, 'maxTimeMS'));
    assert.ok(!Object.hasOwn(getDocuments.inputSchema.properties, 'readPreference'));

    await client.callTool({
      name: 'Dashboard.getDashboards',
      arguments: { maxTimeMS: 600000, readPreference: 'primary' }
    });
    assert.strictEqual(receivedParams.maxTimeMS, 5000);
    assert.strictEqual(receivedParams.readPreference, 'secondary');
  });

  it('passes server supplied identity to actions', async function() {
    await connect({ roles: ['readonly'] });
    const result = await client.callTool({
      name: 'Dashboard.getDashboards',
      arguments: { roles: ['owner'], userId: 'spoofed' }
    });

    assert.deepStrictEqual(receivedParams, {
      authorization: 'access-token',
      initiatedById: '0123456789abcdef01234567',
      roles: ['readonly'],
      userId: '0123456789abcdef01234567'
    });
    assert.deepStrictEqual(JSON.parse(result.content[0].text), {
      dashboards: [{ title: 'Test dashboard' }]
    });
  });
});
