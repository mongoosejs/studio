'use strict';

const assert = require('assert');
require('./setup');

const api = require('../../frontend/src/api');

describe('frontend api SSE streams', function() {
  afterEach(function() {
    delete global.fetch;
    window.localStorage.getItem = () => null;
  });

  it('throws a useful error for empty SSE error events', async function() {
    global.fetch = async() => streamResponse([
      'data: {"chatMessage":{"_id":"1","role":"user","content":"hi"}}\n\n',
      'event: error\ndata: {}\n\n'
    ]);

    const iterator = api.ChatThread.streamChatMessage({ chatThreadId: '1', content: 'hi' });
    const first = await iterator.next();
    assert.deepStrictEqual(first.value, {
      chatMessage: { _id: '1', role: 'user', content: 'hi' }
    });

    await assert.rejects(
      () => iterator.next(),
      err => err.message === 'Streaming request failed.'
    );
  });

  it('throws the server message for SSE error events', async function() {
    global.fetch = async() => streamResponse([
      'event: error\ndata: {"message":"LLM stream failed"}\n\n'
    ]);

    const iterator = api.Model.streamChatMessage({ model: 'Test', content: 'hi' });
    await assert.rejects(
      () => iterator.next(),
      err => err.message === 'LLM stream failed'
    );
  });
});

function streamResponse(chunks) {
  let index = 0;
  return {
    ok: true,
    body: {
      getReader() {
        return {
          async read() {
            if (index >= chunks.length) {
              return { done: true };
            }
            return {
              done: false,
              value: new TextEncoder().encode(chunks[index++])
            };
          }
        };
      }
    }
  };
}
