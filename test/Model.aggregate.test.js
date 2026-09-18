'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
const { actions, connection } = require('./setup.test');

describe('Model.aggregate()', function () {
  const AggregateTest = connection.model('AggregateTest', new mongoose.Schema({
    name: String,
    n: Number
  }));

  afterEach(async function () {
    await AggregateTest.deleteMany();
  });

  it('returns documents from a valid pipeline', async function () {
    await AggregateTest.create([{ name: 'a', n: 1 }, { name: 'b', n: 2 }]);

    const res = await actions.Model.aggregate({
      model: 'AggregateTest',
      pipeline: [{ $match: { name: 'a' } }],
      roles: ['readonly']
    });

    assert.ok(res.docs);
    assert.strictEqual(res.docs.length, 1);
    assert.strictEqual(res.docs[0].name, 'a');
  });

  it('appends a server-side $limit and does not return more than the limit', async function () {
    await AggregateTest.create([{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }, { n: 5 }]);

    const res = await actions.Model.aggregate({
      model: 'AggregateTest',
      pipeline: [{ $match: {} }, { $sort: { n: 1 } }],
      limit: 2,
      roles: ['member']
    });

    assert.strictEqual(res.docs.length, 2);
    assert.strictEqual(res.docs[0].n, 1);
    assert.strictEqual(res.docs[1].n, 2);
  });

  it('defaults limit to 20 when omitted', async function () {
    const docsToCreate = Array.from({ length: 25 }, (_, i) => ({ n: i }));
    await AggregateTest.create(docsToCreate);

    const res = await actions.Model.aggregate({
      model: 'AggregateTest',
      pipeline: [{ $match: {} }],
      roles: ['admin']
    });

    assert.strictEqual(res.docs.length, 20);
  });

  it('clamps limit to 200', async function () {
    const docsToCreate = Array.from({ length: 205 }, (_, i) => ({ n: i }));
    await AggregateTest.create(docsToCreate);

    const res = await actions.Model.aggregate({
      model: 'AggregateTest',
      pipeline: [{ $match: {} }],
      limit: 500,
      roles: ['admin']
    });

    assert.strictEqual(res.docs.length, 200);
  });

  it('clamps a non-positive limit to 1', async function () {
    await AggregateTest.create([{ n: 1 }, { n: 2 }]);

    const res = await actions.Model.aggregate({
      model: 'AggregateTest',
      pipeline: [{ $match: {} }, { $sort: { n: 1 } }],
      limit: 0,
      roles: ['admin']
    });

    assert.strictEqual(res.docs.length, 1);
    assert.strictEqual(res.docs[0].n, 1);
  });

  it('throws if the model does not exist', async function () {
    await assert.rejects(
      () =>
        actions.Model.aggregate({
          model: 'DoesNotExistModel',
          pipeline: [{ $match: {} }],
          roles: ['admin']
        }),
      /Model DoesNotExistModel not found/
    );
  });

  it('throws if pipeline is not an array', async function () {
    await assert.rejects(
      () =>
        actions.Model.aggregate({
          model: 'AggregateTest',
          pipeline: { $match: {} },
          roles: ['admin']
        }),
      /`pipeline` must be an array/
    );
  });

  it('throws if a stage is not a non-null object', async function () {
    await assert.rejects(
      () =>
        actions.Model.aggregate({
          model: 'AggregateTest',
          pipeline: [{ $match: {} }, null],
          roles: ['admin']
        }),
      /Invalid stage at index 1/
    );
  });

  it('throws if the caller is not authorized', async function () {
    await assert.rejects(
      () =>
        actions.Model.aggregate({
          model: 'AggregateTest',
          pipeline: [{ $match: {} }],
          roles: ['nope']
        }),
      /Unauthorized to take action Model\.aggregate/
    );
  });
});
