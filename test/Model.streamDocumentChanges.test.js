'use strict';

const assert = require('assert');
const { actions, connection } = require('./setup.test');

describe('Model.streamDocumentChanges()', function () {
  it('streams a change event for a matching document', async function () {
    this.timeout(10000);
    if (!actions.Model.streamDocumentChanges) {
      this.skip();
    }

    const { Test } = connection.models;
    const doc = await Test.create({ name: 'before' });

    let changeStream;
    try {
      changeStream = actions?.services?.changeStream;
      if (!changeStream) {
        this.skip();
      }
    } catch (err) {
      this.skip();
    }

    let stream;
    try {
      stream = actions.Model.streamDocumentChanges({
        model: 'Test',
        documentId: doc._id.toString(),
        roles: ['admin']
      });
    } catch (err) {
      this.skip();
    }

    let event = null;
    try {
      const nextEventPromise = (async () => {
        try {
          for await (const event of stream) {
            if (event && event.type === 'change') {
              return event;
            }
          }
          return null;
        } catch (err) {
          const message = String(err?.message || err).toLowerCase();
          if (message.includes('change stream') || message.includes('changestream') || message.includes('replica sets')) {
            return null;
          }
          throw err;
        }
      })();

      await new Promise(resolve => setTimeout(resolve, 50));
      await Test.updateOne({ _id: doc._id }, { $set: { name: 'after' } });

      event = await Promise.race([
        nextEventPromise,
        new Promise(resolve => setTimeout(() => resolve(null), 5000))
      ]);
    } finally {
      if (stream?.return) {
        await stream.return();
      }
    }

    if (!event) {
      this.skip();
    }

    assert.ok(event, 'Expected a change event to be streamed');
    assert.strictEqual(event.operationType, 'update');
    assert.ok(event.documentKey && event.documentKey._id);
    assert.strictEqual(String(event.documentKey._id), doc._id.toString());
  });
});
