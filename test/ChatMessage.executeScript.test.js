'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

const executeScript = require('../backend/actions/ChatMessage/executeScript');

describe('ChatMessage.executeScript()', function() {
  it('runs dry runs inside db.transaction() and persists the execution result afterwards', async function() {
    let transactionCalls = 0;
    let saved = false;

    const chatMessage = {
      _id: new mongoose.Types.ObjectId(),
      chatThreadId: new mongoose.Types.ObjectId(),
      content: '```js\nreturn 42;\n```',
      script: 'return 42;',
      executionResult: null,
      async save() {
        saved = true;
      }
    };

    const action = executeScript({
      db: {
        transaction: async fn => {
          ++transactionCalls;
          return await fn();
        }
      },
      studioConnection: {
        model(name) {
          if (name === '__Studio_ChatMessage') {
            return {
              findById: async id => id.toString() === chatMessage._id.toString() ? chatMessage : null
            };
          }
          if (name === '__Studio_ChatThread') {
            return {
              findById: id => ({
                async orFail() {
                  assert.strictEqual(id.toString(), chatMessage.chatThreadId.toString());
                  return { _id: id };
                }
              })
            };
          }
          throw new Error(`Unexpected model ${name}`);
        }
      }
    });

    const res = await action({
      chatMessageId: chatMessage._id,
      script: 'return 42;',
      dryRun: true,
      roles: ['admin']
    });

    assert.strictEqual(transactionCalls, 1);
    assert.strictEqual(saved, true);
    assert.strictEqual(res.chatMessage, chatMessage);
    assert.deepStrictEqual(chatMessage.executionResult, {
      output: 42,
      logs: '',
      error: null,
      dryRun: true
    });
  });
});
