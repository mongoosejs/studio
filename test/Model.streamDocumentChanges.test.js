'use strict';

const assert = require('assert');
const { actions, connection } = require('./setup.test');

describe('Model.streamDocumentChanges()', function () {
  it('streams a change event for a matching document', async function () {
    this.timeout(10000);

    const { Test } = connection.models;

    const doc = await Test.create({ name: 'before' });
    const stream = actions.Model.streamDocumentChanges({
      model: 'Test',
      documentId: doc._id.toString(),
      roles: ['admin']
    });

    let event = null;
    const nextEventPromise = (async () => {
      for await (const event of stream) {
        if (event && event.type === 'change') {
          return event;
        }
      }
      return null;
    })();

    await new Promise(resolve => setTimeout(resolve, 50));
    await Test.updateOne({ _id: doc._id }, { $set: { name: 'after' } });

    event = await Promise.race([
      nextEventPromise,
      new Promise(resolve => setTimeout(() => resolve(null), 5000))
    ]);

    assert.ok(event, 'Expected a change event to be streamed');
    assert.strictEqual(event.operationType, 'update');
    assert.ok(event.documentKey && event.documentKey._id);
    assert.strictEqual(String(event.documentKey._id), doc._id.toString());
  });
});
