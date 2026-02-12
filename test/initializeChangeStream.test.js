'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

const initializeChangeStream = require('../backend/changeStream/initializeChangeStream');

const connection = mongoose.createConnection('mongodb://127.0.0.1:27017/studio_change_stream_test', {
  serverSelectionTimeoutMS: 5000
});
const Test = connection.model('ChangeStreamTest', new mongoose.Schema({ name: String }));

describe('initializeChangeStream()', function () {
  before(async function () {
    this.timeout(10000);
    await connection.asPromise();
    await Test.deleteMany();
  });

  afterEach(async function () {
    this.timeout(10000);
    await Test.deleteMany();
  });

  after(async function () {
    this.timeout(10000);
    await connection.close();
  });

  it('streams changes when change streams are enabled', async function () {
    this.timeout(10000);

    const changeStream = initializeChangeStream(connection, { changeStream: true });
    assert.ok(changeStream, 'Expected a change stream to be initialized');

    const nextChange = new Promise((resolve, reject) => {
      changeStream.once('change', resolve);
      changeStream.once('error', reject);
    });

    await Test.create({ name: 'before' });

    let timeoutId;
    let change;
    try {
      change = await Promise.race([
        nextChange,
        new Promise(resolve => {
          timeoutId = setTimeout(() => resolve(null), 5000);
          if (timeoutId && typeof timeoutId.unref === 'function') {
            timeoutId.unref();
          }
        })
      ]);

      assert.ok(change, 'Expected to receive a change event');
      assert.strictEqual(change.operationType, 'insert');
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      await changeStream.close();
    }
  });

  it('does not create a change stream when disabled', function () {
    const changeStream = initializeChangeStream(connection, { changeStream: false });

    assert.strictEqual(changeStream, null);
  });
});
