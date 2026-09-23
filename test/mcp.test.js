'use strict';

const assert = require('assert');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const express = require('express');
const { applySpec } = require('extrovert');

const Actions = require('../backend/actions');
const mcp = require('../backend/mcp');

describe('MCP', function() {
  let httpServer;
  let client;
  let receivedParams;

  beforeEach(async function() {
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
        roles: ['readonly'],
        userId: '0123456789abcdef01234567'
      };
      next();
    }, mcp(backend));

    await new Promise(resolve => {
      httpServer = app.listen(0, '127.0.0.1', resolve);
    });
    const { port } = httpServer.address();
    client = new Client({ name: 'mongoose-studio-test', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
  });

  afterEach(async function() {
    await client.close();
    await new Promise(resolve => httpServer.close(resolve));
  });

  it('exposes Dashboard and Model actions as tools', async function() {
    const { tools } = await client.listTools();
    const expectedTools = ['Dashboard', 'Model'].flatMap(namespace =>
      Object.keys(Actions[namespace]).map(action => `${namespace}.${action}`)
    ).sort();
    assert.deepStrictEqual(tools.map(tool => tool.name).sort(), expectedTools);

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

  it('passes server supplied identity to actions', async function() {
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
