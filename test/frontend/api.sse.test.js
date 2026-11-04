'use strict';

const assert = require('assert');
const sinon = require('sinon');
require('./setup');

const api = require('../../frontend/src/api');

describe('frontend api SSE streams', function() {
  afterEach(function() {
    sinon.restore();
    window.localStorage.getItem = () => null;
  });

  it('throws a useful error for empty SSE error events', async function() {
    sinon.stub(api, 'fetch').callsFake(async() => streamResponse([
      'data: {"chatMessage":{"_id":"1","role":"user","content":"hi"}}\n\n',
      'event: error\ndata: {}\n\n'
    ]));

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
    sinon.stub(api, 'fetch').callsFake(async() => streamResponse([
      'event: error\ndata: {"message":"LLM stream failed"}\n\n'
    ]));

    const iterator = api.Model.streamChatMessage({ model: 'Test', content: 'hi' });
    await assert.rejects(
      () => iterator.next(),
      err => err.message === 'LLM stream failed'
    );
  });

  it('POSTs syncIndexes params as JSON and yields progress events', async function() {
    const event = { list: 'toDrop', position: 0, name: 'a_1', status: 'succeeded' };
    const fetchStub = sinon.stub(api, 'fetch').callsFake(async() => streamResponse([
      `data: ${JSON.stringify(event)}\n\n`
    ]));

    const params = { model: 'Test', toCreate: [[{ b: 1 }, { unique: true }]], toDrop: ['a_1'] };
    const events = [];
    for await (const event of api.Model.syncIndexes(params)) {
      events.push(event);
    }

    assert.deepStrictEqual(events, [event]);
    const [url, options] = fetchStub.firstCall.args;
    assert.strictEqual(url, 'http://localhost:9998/Model/syncIndexes');
    assert.strictEqual(options.method, 'POST');
    assert.strictEqual(options.headers['Content-Type'], 'application/json');
    assert.deepStrictEqual(JSON.parse(options.body), params);
  });

  it('syncs indexes without streaming on lambda deployments', async function() {
    window.MONGOOSE_STUDIO_CONFIG.isLambda = true;
    const apiPath = require.resolve('../../frontend/src/api');
    const originalApiModule = require.cache[apiPath];
    delete require.cache[apiPath];
    const lambdaApi = require('../../frontend/src/api');
    delete window.MONGOOSE_STUDIO_CONFIG.isLambda;
    require.cache[apiPath] = originalApiModule;
    const post = sinon.stub(window.apiClient, 'post').callsFake(async(url, { action }) => {
      if (action === 'Model.dropIndex') {
        throw new Error('index not found');
      }
      return { data: { indexName: 'b_1' } };
    });

    const events = [];
    for await (const event of lambdaApi.Model.syncIndexes({ model: 'Test', toCreate: [[{ b: 1 }, {}]], toDrop: ['a_1'] })) {
      events.push(event);
    }

    assert.deepStrictEqual(events, [
      { list: 'toDrop', position: 0, name: 'a_1', status: 'inProgress' },
      { list: 'toDrop', position: 0, name: 'a_1', status: 'failed', error: 'index not found' },
      { list: 'toCreate', position: 0, name: undefined, status: 'inProgress' },
      { list: 'toCreate', position: 0, name: 'b_1', status: 'succeeded' }
    ]);
    assert.deepStrictEqual(post.getCalls().map(call => call.args[1]), [
      { action: 'Model.dropIndex', model: 'Test', name: 'a_1' },
      { action: 'Model.createIndex', model: 'Test', key: { b: 1 }, options: {} }
    ]);
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
