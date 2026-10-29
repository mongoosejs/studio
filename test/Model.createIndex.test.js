'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
const { actions, connection } = require('./setup.test');

describe('Model.createIndex()', function() {
  const schema = new mongoose.Schema({
    email: { type: String, unique: true },
    createdAt: Date
  }, { autoIndex: false });
  schema.index({ createdAt: 1 }, { expires: '1d', name: 'createdAtTTL' });
  const CreateIndexTest = connection.model('CreateIndexTest', schema);

  beforeEach(async function() {
    await CreateIndexTest.createCollection();
  });

  afterEach(async function() {
    await CreateIndexTest.collection.drop();
  });

  it('creates indexes from getIndexes() diffIndexes.toCreate', async function() {
    const { diffIndexes } = await actions.Model.getIndexes({ model: 'CreateIndexTest', roles: ['admin'] });
    assert.deepStrictEqual(diffIndexes.toCreate, [
      [{ email: 1 }, { unique: true, _autoIndex: false }],
      [{ createdAt: 1 }, { name: 'createdAtTTL', expireAfterSeconds: 86400 }]
    ]);

    let res = await actions.Model.createIndex({
      model: 'CreateIndexTest',
      key: diffIndexes.toCreate[0][0],
      options: diffIndexes.toCreate[0][1],
      roles: ['admin']
    });
    assert.strictEqual(res.indexName, 'email_1');
    assert.deepStrictEqual(res.diffIndexes.toCreate, [
      [{ createdAt: 1 }, { name: 'createdAtTTL', expireAfterSeconds: 86400 }]
    ]);

    res = await actions.Model.createIndex({
      model: 'CreateIndexTest',
      key: res.diffIndexes.toCreate[0][0],
      options: res.diffIndexes.toCreate[0][1],
      roles: ['admin']
    });
    assert.strictEqual(res.indexName, 'createdAtTTL');
    assert.deepStrictEqual(res.diffIndexes.toCreate, []);

    const { mongoDBIndexes, diffIndexes: diffAfterCreate } = await actions.Model.createIndex({
      model: 'CreateIndexTest',
      key: { createdAt: 1, email: 1 },
      roles: ['admin']
    });
    assert.deepStrictEqual(diffAfterCreate.toDrop, ['createdAt_1_email_1']);
    assert.deepStrictEqual(
      mongoDBIndexes.map(({ key, name, unique, expireAfterSeconds }) => ({ key, name, unique, expireAfterSeconds })),
      [
        { key: { _id: 1 }, name: '_id_', unique: undefined, expireAfterSeconds: undefined },
        { key: { email: 1 }, name: 'email_1', unique: true, expireAfterSeconds: undefined },
        { key: { createdAt: 1 }, name: 'createdAtTTL', unique: undefined, expireAfterSeconds: 86400 },
        { key: { createdAt: 1, email: 1 }, name: 'createdAt_1_email_1', unique: undefined, expireAfterSeconds: undefined }
      ]
    );
  });

  it('dropIndex() returns dropped schema indexes in diffIndexes.toCreate', async function() {
    await CreateIndexTest.createIndexes();

    const { mongoDBIndexes, diffIndexes } = await actions.Model.dropIndex({
      model: 'CreateIndexTest',
      name: 'email_1',
      roles: ['admin']
    });
    assert.deepStrictEqual(mongoDBIndexes.map(index => index.name), ['_id_', 'createdAtTTL']);
    assert.deepStrictEqual(diffIndexes.toCreate, [
      [{ email: 1 }, { unique: true, _autoIndex: false }]
    ]);
  });

  it('requires owner or admin role', async function() {
    await assert.rejects(
      actions.Model.createIndex({ model: 'CreateIndexTest', key: { email: 1 }, roles: ['member'] }),
      /Unauthorized to take action Model.createIndex/
    );
  });
});
