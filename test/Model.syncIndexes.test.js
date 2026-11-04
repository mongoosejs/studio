'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
const sinon = require('sinon');
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
    sinon.restore();
    await SyncIndexesTest.collection.drop();
  });

  async function collectEvents(params) {
    const events = [];
    for await (const event of actions.Model.syncIndexes({ model: 'SyncIndexesTest', roles: ['admin'], ...params })) {
      events.push(event);
    }
    return events;
  }

  function slowDownCreateIndex(delayMS) {
    const createIndex = SyncIndexesTest.collection.createIndex.bind(SyncIndexesTest.collection);
    sinon.stub(SyncIndexesTest.collection, 'createIndex').callsFake(async(...args) => {
      await new Promise(resolve => setTimeout(resolve, delayMS));
      return createIndex(...args);
    });
  }

  it('applies diffIndexes() and streams the status of each index', async function() {
    await SyncIndexesTest.collection.createIndex({ createdAt: 1, email: 1 });
    const { diffIndexes } = await actions.Model.getIndexes({ model: 'SyncIndexesTest', roles: ['admin'] });

    const events = await collectEvents(diffIndexes);

    assert.deepStrictEqual(events, [
      { list: 'toDrop', position: 0, name: 'createdAt_1_email_1', status: 'inProgress' },
      { list: 'toDrop', position: 0, name: 'createdAt_1_email_1', status: 'succeeded' },
      { list: 'toCreate', position: 0, name: 'email_1', status: 'inProgress' },
      { list: 'toCreate', position: 0, name: 'email_1', status: 'succeeded', phases: {} },
      { list: 'toCreate', position: 1, name: 'createdAtTTL', status: 'inProgress' },
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
      toDrop: ['doesNotExist'],
      toCreate: [[{ email: 1 }, { unique: true }], [{ createdAt: 1 }, {}]]
    });

    const results = events.filter(event => event.status !== 'inProgress');
    assert.deepStrictEqual(results.map(({ name, status }) => ({ name, status })), [
      { name: 'doesNotExist', status: 'failed' },
      { name: 'email_1', status: 'failed' },
      { name: 'createdAt_1', status: 'succeeded' }
    ]);
    assert.match(results[0].error, /index not found/);
    assert.match(results[1].error, /E11000/);
  });

  it('reports the progress of each build phase from $currentOp', async function() {
    this.timeout(6000);
    const scanning = 'Index Build: scanning collection Index Build: scanning collection';
    const sorting = 'Index Build: inserting keys from external sorter into index Index Build: inserting keys from external sorter into index';
    const ops = [
      { progress: { done: 1, total: 4 }, msg: `${scanning}: 1/4 25%` },
      { progress: { done: 3, total: 4 }, msg: `${scanning}: 3/4 75%` },
      { progress: { done: 2, total: 4 }, msg: `${sorting}: 2/4 50%` },
      { progress: { done: 1, total: 8 }, msg: 'Index Build: draining writes received during build: 1/8 12%' }
    ];
    const aggregate = sinon.stub().callsFake(() => ({ toArray: async() => [ops.shift()] }));
    sinon.stub(SyncIndexesTest.db, 'getClient').returns({ db: () => ({ aggregate }) });
    slowDownCreateIndex(4100);

    const events = await collectEvents({ toCreate: [[{ email: 1 }, {}]] });

    const event = { list: 'toCreate', position: 0, name: 'email_1' };
    const phases = {
      'scanning collection': { done: 3, total: 4 },
      'inserting keys from external sorter into index': { done: 2, total: 4 },
      'draining writes received during build': { done: 1, total: 8 }
    };
    assert.deepStrictEqual(events, [
      { ...event, status: 'inProgress' },
      { ...event, status: 'inProgress', phases: { 'scanning collection': { done: 1, total: 4 } } },
      { ...event, status: 'inProgress', phases: { 'scanning collection': { done: 3, total: 4 } } },
      {
        ...event,
        status: 'inProgress',
        phases: {
          'scanning collection': { done: 3, total: 4 },
          'inserting keys from external sorter into index': { done: 2, total: 4 }
        }
      },
      { ...event, status: 'inProgress', phases },
      { ...event, status: 'succeeded', phases }
    ]);
    const [{ $currentOp }, { $match }] = aggregate.firstCall.args[0];
    assert.deepStrictEqual($currentOp, { allUsers: false });
    assert.deepStrictEqual($match, {
      ns: `${connection.name}.${SyncIndexesTest.collection.name}`,
      'command.indexes.name': 'email_1',
      progress: { $exists: true }
    });
  });

  it('still syncs and sends heartbeats if $currentOp fails', async function() {
    this.timeout(5000);
    const aggregate = sinon.stub().returns({
      toArray: async() => {
        throw new Error('$currentOp is not allowed');
      }
    });
    sinon.stub(SyncIndexesTest.db, 'getClient').returns({ db: () => ({ aggregate }) });
    slowDownCreateIndex(2100);

    const events = await collectEvents({ toCreate: [[{ email: 1 }, {}]] });

    const event = { list: 'toCreate', position: 0, name: 'email_1' };
    assert.deepStrictEqual(events, [
      { ...event, status: 'inProgress' },
      { ...event, status: 'inProgress', phases: {} },
      { ...event, status: 'inProgress', phases: {} },
      { ...event, status: 'succeeded', phases: {} }
    ]);
  });

  it('requires owner or admin role', async function() {
    await assert.rejects(
      collectEvents({ toDrop: ['email_1'], roles: ['member'] }),
      /Unauthorized to take action Model.syncIndexes/
    );
  });
});
