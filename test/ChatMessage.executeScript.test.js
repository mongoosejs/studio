'use strict';

const assert = require('assert');
const { actions, connection, studioConnection } = require('./setup.test');

describe('ChatMessage.executeScript()', function() {
  let ChatMessage;
  let ChatThread;
  let Test;

  before(function() {
    ChatMessage = studioConnection.model('__Studio_ChatMessage');
    ChatThread = studioConnection.model('__Studio_ChatThread');
    Test = connection.model('Test');
  });

  afterEach(async function() {
    await Promise.all([
      ChatMessage.deleteMany(),
      ChatThread.deleteMany(),
      Test.deleteMany()
    ]);
  });

  it('runs dry runs inside db.transaction() and persists the execution result afterwards', async function() {
    const chatMessage = await createChatMessage('```js\nreturn 42;\n```', 'return 42;');

    const res = await actions.ChatMessage.executeScript({
      chatMessageId: chatMessage._id,
      script: 'return 42;',
      dryRun: true,
      roles: ['admin']
    });

    assert.strictEqual(res.chatMessage.executionResult.output, 42);
    assert.strictEqual(res.chatMessage.executionResult.logs, '');
    assert.strictEqual(res.chatMessage.executionResult.error, null);
    assert.strictEqual(res.chatMessage.executionResult.dryRun, true);

    const persisted = await ChatMessage.findById(chatMessage._id).lean().orFail();
    assert.strictEqual(persisted.executionResult.output, 42);
    assert.strictEqual(persisted.executionResult.dryRun, true);
  });

  it('rolls back dry run Model.collection calls', async function() {
    const chatMessage = await createChatMessage(
      '```js\nawait db.models.Test.collection.insertOne({ name: \'test\' }); return \'ok\';\n```',
      ''
    );

    await actions.ChatMessage.executeScript({
      chatMessageId: chatMessage._id,
      script: 'await db.models.Test.collection.insertOne({ name: \'test\' }); return \'ok\';',
      dryRun: true,
      roles: ['admin']
    });

    assert.strictEqual(await Test.countDocuments(), 0);
  });

  it('rolls back dry run Model.insertOne calls without options', async function() {
    const chatMessage = await createChatMessage(
      '```js\nawait db.models.Test.insertOne({ name: \'test\' }); return \'ok\';\n```',
      ''
    );

    await actions.ChatMessage.executeScript({
      chatMessageId: chatMessage._id,
      script: 'await db.models.Test.insertOne({ name: \'test\' }); return \'ok\';',
      dryRun: true,
      roles: ['admin']
    });

    assert.strictEqual(await Test.countDocuments(), 0);
  });

  it('rolls back dry run Model.findOne calls without options', async function() {
    await Test.create({ name: 'test' });
    const chatMessage = await createChatMessage(
      '```js\nreturn (await db.models.Test.findOne({ name: \'test\' })).name;\n```',
      ''
    );

    const res = await actions.ChatMessage.executeScript({
      chatMessageId: chatMessage._id,
      script: 'return (await db.models.Test.findOne({ name: \'test\' })).name;',
      dryRun: true,
      roles: ['admin']
    });

    assert.strictEqual(res.chatMessage.executionResult.output, 'test');
  });

  it('does not reuse a previous dry run session for non-dry collection calls', async function() {
    const chatMessage = await createChatMessage(
      '```js\nawait db.models.Test.collection.insertOne({ name: \'test\' }); return \'ok\';\n```',
      ''
    );
    const params = {
      chatMessageId: chatMessage._id,
      script: 'await db.models.Test.collection.insertOne({ name: \'test\' }); return \'ok\';',
      roles: ['admin']
    };

    await actions.ChatMessage.executeScript({ ...params, dryRun: true });
    await actions.ChatMessage.executeScript({ ...params, dryRun: false });

    const docs = await Test.find().lean();
    assert.deepStrictEqual(docs.map(doc => doc.name), ['test']);
  });

  it('rolls back dry run Model.findOneAndUpdate calls', async function() {
    await Test.create({ name: 'test' });
    const chatMessage = await createChatMessage(
      '```js\nawait db.models.Test.findOneAndUpdate({ name: \'test\' }, { $set: { name: \'updated\' } }, { returnDocument: \'after\' }); return \'ok\';\n```',
      ''
    );

    await actions.ChatMessage.executeScript({
      chatMessageId: chatMessage._id,
      script: 'await db.models.Test.findOneAndUpdate({ name: \'test\' }, { $set: { name: \'updated\' } }, { returnDocument: \'after\' }); return \'ok\';',
      dryRun: true,
      roles: ['admin']
    });

    const doc = await Test.findOne().lean().orFail();
    assert.strictEqual(doc.name, 'test');
  });

  it('adds the dry run transaction session to collection index, drop, and rename calls', async function() {
    const seenMethods = [];
    const originalDebug = connection.options?.debug;
    connection.set('debug', function(collectionName, methodName) {
      const args = Array.prototype.slice.call(arguments, 2);
      if ([
        'createIndex',
        'createIndexes',
        'drop',
        'dropIndex',
        'dropIndexes',
        'rename'
      ].includes(methodName)) {
        seenMethods.push({
          methodName,
          hasSession: args.some(arg => arg?.session != null)
        });
      }
    });

    try {
      const chatMessage = await createChatMessage(
        '```js\nreturn \'ok\';\n```',
        ''
      );

      await actions.ChatMessage.executeScript({
        chatMessageId: chatMessage._id,
        script: `
        const methods = [
          ['createIndex', [{ name: 1 }]],
          ['createIndexes', [[{ key: { name: 1 }, name: 'name_1_dry_run' }]]],
          ['drop', []],
          ['dropIndex', ['name_1_dry_run']],
          ['dropIndexes', []],
          ['rename', ['tests_dry_run_renamed']]
        ];
        for (const [methodName, args] of methods) {
          await db.models.Test.collection[methodName](...args).catch(() => {});
        }
        return 'ok';
      `,
        dryRun: true,
        roles: ['admin']
      });
    } finally {
      connection.set('debug', originalDebug);
    }

    for (const methodName of ['createIndex', 'createIndexes', 'drop', 'dropIndex', 'dropIndexes', 'rename']) {
      assert.strictEqual(
        seenMethods.some(method => method.methodName === methodName && method.hasSession),
        true,
        `Expected ${methodName} to include a session`
      );
    }
  });

  async function createChatMessage(content, script) {
    const chatThread = await ChatThread.create({ title: 'Test thread' });
    return await ChatMessage.create({
      chatThreadId: chatThread._id,
      role: 'assistant',
      content,
      script
    });
  }

});
