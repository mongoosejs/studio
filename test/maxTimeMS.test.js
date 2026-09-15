'use strict';

const assert = require('assert');
const Backend = require('../backend');
const { connection, studioConnection } = require('./setup.test');

const MAX_TIME_MS = 12345;
const USER_CONNECTION_MAX_TIME_MS = 54321;
const USER_STUDIO_CONNECTION_MAX_TIME_MS = 54322;

describe('maxTimeMS option', function() {
  let actions;
  let originalConnectionMaxTimeMS;
  let originalStudioConnectionMaxTimeMS;
  let connectionHadMaxTimeMS;
  let studioConnectionHadMaxTimeMS;

  before(function() {
    connectionHadMaxTimeMS = Object.hasOwn(connection.options ?? {}, 'maxTimeMS');
    studioConnectionHadMaxTimeMS = Object.hasOwn(studioConnection.options ?? {}, 'maxTimeMS');
    originalConnectionMaxTimeMS = connection.options?.maxTimeMS;
    originalStudioConnectionMaxTimeMS = studioConnection.options?.maxTimeMS;
    connection.set('maxTimeMS', USER_CONNECTION_MAX_TIME_MS);
    studioConnection.set('maxTimeMS', USER_STUDIO_CONNECTION_MAX_TIME_MS);
    actions = Backend(connection, studioConnection, { maxTimeMS: MAX_TIME_MS });
  });

  after(function() {
    restoreMaxTimeMS(connection, connectionHadMaxTimeMS, originalConnectionMaxTimeMS);
    restoreMaxTimeMS(studioConnection, studioConnectionHadMaxTimeMS, originalStudioConnectionMaxTimeMS);
  });

  afterEach(async function() {
    await Promise.all([
      studioConnection.model('__Studio_Dashboard').deleteMany(),
      studioConnection.model('__Studio_ChatMessage').deleteMany(),
      studioConnection.model('__Studio_ChatThread').deleteMany()
    ]);
  });

  it('does not set maxTimeMS on the application or Studio connections', function() {
    assert.strictEqual(connection.get('maxTimeMS'), USER_CONNECTION_MAX_TIME_MS);
    assert.strictEqual(studioConnection.get('maxTimeMS'), USER_STUDIO_CONNECTION_MAX_TIME_MS);
  });

  it('applies maxTimeMS to Model update operations', async function() {
    const Test = connection.model('Test');
    const doc = await Test.create({ name: 'before' });
    const operations = await captureOperations(connection, async() => {
      await actions.Model.updateDocuments({
        model: 'Test',
        _id: [doc._id.toString()],
        update: { name: 'after' },
        roles: ['admin']
      });
    });

    assertOperationHasMaxTimeMS(operations, 'updateMany');
  });

  it('applies maxTimeMS to Model read operations without changing the connection', async function() {
    const operations = await captureOperations(connection, async() => {
      await actions.Model.getDocuments({ model: 'Test', roles: ['admin'] });
    });

    assertOperationHasMaxTimeMS(operations, 'find');
    assertOperationHasMaxTimeMS(operations, 'estimatedDocumentCount');
    assert.strictEqual(connection.get('maxTimeMS'), USER_CONNECTION_MAX_TIME_MS);
  });

  it('overrides script maxTimeMS in dashboard sandbox operations', async function() {
    const Dashboard = studioConnection.model('__Studio_Dashboard');
    const dashboard = await Dashboard.create({
      title: 'maxTimeMS dashboard',
      code: `
        await db.models.Test.collection.updateOne({}, { $set: { name: 'dashboard' } }, { maxTimeMS: 99999 });
        return { ok: true };
      `
    });

    const operations = await captureOperations(connection, async() => {
      await actions.Dashboard.getDashboard({
        dashboardId: dashboard._id,
        evaluate: true,
        roles: ['admin']
      });
    });

    assertOperationHasMaxTimeMS(operations, 'updateOne');
    assert.strictEqual(connection.get('maxTimeMS'), USER_CONNECTION_MAX_TIME_MS);
  });

  it('overrides script maxTimeMS in chat message sandbox operations', async function() {
    const ChatThread = studioConnection.model('__Studio_ChatThread');
    const ChatMessage = studioConnection.model('__Studio_ChatMessage');
    const chatThread = await ChatThread.create({ title: 'maxTimeMS chat' });
    const chatMessage = await ChatMessage.create({
      chatThreadId: chatThread._id,
      role: 'assistant',
      content: '```js\nreturn true;\n```',
      script: 'return true;'
    });

    const operations = await captureOperations(connection, async() => {
      await actions.ChatMessage.executeScript({
        chatMessageId: chatMessage._id,
        script: `
          await db.models.Test.collection.updateOne({}, { $set: { name: 'chat' } }, { maxTimeMS: 99999 });
          return true;
        `,
        roles: ['admin']
      });
    });

    assertOperationHasMaxTimeMS(operations, 'updateOne');
    assert.strictEqual(connection.get('maxTimeMS'), USER_CONNECTION_MAX_TIME_MS);
  });
});

async function captureOperations(db, fn) {
  const operations = [];
  const originalDebug = db.options?.debug;
  db.set('debug', function(collectionName, methodName) {
    operations.push({
      collectionName,
      methodName,
      args: Array.prototype.slice.call(arguments, 2)
    });
  });

  try {
    await fn();
  } finally {
    db.set('debug', originalDebug);
  }

  return operations;
}

function assertOperationHasMaxTimeMS(operations, methodName) {
  const operation = operations.find(operation => operation.methodName === methodName);
  assert.ok(operation, `Expected a ${methodName} operation`);
  assert.ok(
    operation.args.some(arg => arg?.maxTimeMS === MAX_TIME_MS),
    `Expected ${methodName} to use maxTimeMS=${MAX_TIME_MS}: ${JSON.stringify(operation.args)}`
  );
}

function restoreMaxTimeMS(db, hadOption, value) {
  if (hadOption) {
    db.set('maxTimeMS', value);
  } else if (db.options != null) {
    delete db.options.maxTimeMS;
  }
}
