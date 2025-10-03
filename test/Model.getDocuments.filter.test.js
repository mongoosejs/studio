'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
const { actions, connection } = require('./setup.test');

describe('Model.getDocuments() searchText', function() {
  const FilterTest = connection.model('FilterTest', new mongoose.Schema({
    name: String,
    createdAt: Date,
    value: Number
  }));

  afterEach(async function() {
    await FilterTest.deleteMany();
  });

  it('parses object filters from searchText', async function() {
    const matching = await FilterTest.create({ name: 'alpha' });
    await FilterTest.create({ name: 'beta' });

    const res = await actions.Model.getDocuments({
      model: 'FilterTest',
      searchText: '{ name: "alpha" }',
      roles: ['admin']
    });

    assert.strictEqual(res.docs.length, 1);
    assert.strictEqual(res.docs[0]._id.toString(), matching._id.toString());
  });

  it('supports ObjectId helper in searchText', async function() {
    const doc = await FilterTest.create({ name: 'gamma' });
    await FilterTest.create({ name: 'delta' });

    const res = await actions.Model.getDocuments({
      model: 'FilterTest',
      searchText: `{ _id: ObjectId("${doc._id.toString()}") }`,
      roles: ['admin']
    });

    assert.strictEqual(res.docs.length, 1);
    assert.strictEqual(res.docs[0]._id.toString(), doc._id.toString());
  });

  it('supports calling ObjectId without new keyword', async function() {
    const manualId = new mongoose.Types.ObjectId('0'.repeat(24));
    await FilterTest.create({ _id: manualId, name: 'manual' });
    await FilterTest.create({ name: 'other' });

    const res = await actions.Model.getDocuments({
      model: 'FilterTest',
      searchText: "{ _id: ObjectId('0'.repeat(24)) }",
      roles: ['admin']
    });

    assert.strictEqual(res.docs.length, 1);
    assert.strictEqual(res.docs[0]._id.toString(), manualId.toString());
  });

  it('provides Date and Math globals for searchText', async function() {
    const early = await FilterTest.create({ name: 'early', createdAt: new Date('2020-01-01'), value: 1 });
    await FilterTest.create({ name: 'late', createdAt: new Date('2022-01-01'), value: 10 });

    const res = await actions.Model.getDocuments({
      model: 'FilterTest',
      searchText: '{ createdAt: { $lt: new Date("2021-01-01") }, value: { $lt: Math.ceil(2.3) } }',
      roles: ['admin']
    });

    assert.strictEqual(res.docs.length, 1);
    assert.strictEqual(res.docs[0]._id.toString(), early._id.toString());
  });
});
