'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
const { actions, connection } = require('./setup.test');

describe('Model.syncIndexes()', function() {
  const schema = new mongoose.Schema({
    email: { type: String, unique: true },
    createdAt: Date
  }, { autoIndex: false });
  schema.index({ createdAt: 1 }, { expires: '1d', name: 'createdAtTTL' });
  const SyncIndexesTest = connection.model('SyncIndexesTest', schema);

  beforeEach(async function() {
    await SyncIndexesTest.createCollection();
  });

  afterEach(async function() {
    await SyncIndexesTest.collection.drop();
  });

  async function collectEvents(params) {
    const events = [];
    for await (const event of actions.Model.syncIndexes({ model: 'SyncIndexesTest', roles: ['admin'], ...params })) {
      events.push(event);
    }
    return events;
  }

  it('applies diffIndexes() and streams the status of each index', async function() {
    await SyncIndexesTest.collection.createIndex({ createdAt: 1, email: 1 });
    const { diffIndexes } = await actions.Model.getIndexes({ model: 'SyncIndexesTest', roles: ['admin'] });

    const events = await collectEvents(diffIndexes);

    assert.deepStrictEqual(events.filter(event => event.status !== 'inProgress'), [
      { list: 'toDrop', position: 0, name: 'createdAt_1_email_1', status: 'succeeded' },
      { list: 'toCreate', position: 0, name: 'email_1', status: 'succeeded', phases: {} },
      { list: 'toCreate', position: 1, name: 'createdAtTTL', status: 'succeeded', phases: {} }
    ]);
    const { mongoDBIndexes, diffIndexes: diffAfterSync } = await actions.Model.getIndexes({ model: 'SyncIndexesTest', roles: ['admin'] });
    assert.deepStrictEqual(mongoDBIndexes.map(index => index.name), ['_id_', 'email_1', 'createdAtTTL']);
    assert.deepStrictEqual(diffAfterSync, { toDrop: [], toCreate: [] });
  });

  it('only changes the indexes it was given', async function() {
    await SyncIndexesTest.collection.createIndex({ createdAt: 1, email: 1 });

    await collectEvents({ toCreate: [[{ email: 1 }, { unique: true }]] });

    const indexes = await SyncIndexesTest.listIndexes();
    assert.deepStrictEqual(indexes.map(index => index.name), ['_id_', 'createdAt_1_email_1', 'email_1']);
  });

  it('drops indexes before creating them so changed indexes can be recreated', async function() {
    await SyncIndexesTest.collection.createIndex({ email: 1 });

    const events = await collectEvents({ toDrop: ['email_1'], toCreate: [[{ email: 1 }, { unique: true }]] });

    assert.ok(events.every(event => event.status !== 'failed'));
    const indexes = await SyncIndexesTest.listIndexes();
    assert.strictEqual(indexes.find(index => index.name === 'email_1').unique, true);
  });

  it('reports failures and continues with the remaining indexes', async function() {
    await SyncIndexesTest.collection.insertMany([{ email: 'a' }, { email: 'a' }]);

    const events = await collectEvents({
      toDrop: ['_id_'],
      toCreate: [[{ email: 1 }, { unique: true }], [{ createdAt: 1 }, {}]]
    });

    const results = events.filter(event => event.status !== 'inProgress');
    assert.deepStrictEqual(results.map(({ name, status }) => ({ name, status })), [
      { name: '_id_', status: 'failed' },
      { name: 'email_1', status: 'failed' },
      { name: 'createdAt_1', status: 'succeeded' }
    ]);
    assert.match(results[0].error, /cannot drop _id index/);
    assert.match(results[1].error, /E11000/);
  });

  it('requires owner or admin role', async function() {
    await assert.rejects(
      collectEvents({ toDrop: ['email_1'], roles: ['member'] }),
      /Unauthorized to take action Model.syncIndexes/
    );
  });
});
