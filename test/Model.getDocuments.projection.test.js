'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
const { actions, connection } = require('./setup.test');

describe('Model.getDocuments() projection', function() {
  const ProjectionFieldsTest = connection.model(
    'ProjectionFieldsTest',
    new mongoose.Schema({
      name: String,
      email: String,
      value: Number,
      createdAt: Date
    })
  );

  afterEach(async function() {
    await ProjectionFieldsTest.deleteMany();
  });

  it('includes all fields when fields is omitted', async function() {
    const doc = await ProjectionFieldsTest.create({
      name: 'Bob',
      email: 'bob@example.com',
      value: 456,
      createdAt: new Date('2021-01-01')
    });

    const res = await actions.Model.getDocuments({
      model: 'ProjectionFieldsTest',
      roles: ['admin']
    });

    assert.strictEqual(res.docs.length, 1);
    assert.strictEqual(res.docs[0]._id.toString(), doc._id.toString());
    assert.strictEqual(res.docs[0].name, 'Bob');
    assert.strictEqual(res.docs[0].email, 'bob@example.com');
    assert.strictEqual(res.docs[0].value, 456);
    assert.strictEqual(new Date(res.docs[0].createdAt).toISOString(), doc.createdAt.toISOString());
  });

  it('supports raw projectionInput inclusion syntax', async function() {
    const doc = await ProjectionFieldsTest.create({
      name: 'Carol',
      email: 'carol@example.com',
      value: 789,
      createdAt: new Date('2022-01-01')
    });

    const res = await actions.Model.getDocuments({
      model: 'ProjectionFieldsTest',
      projectionInput: 'name email',
      roles: ['admin']
    });

    assert.strictEqual(res.docs.length, 1);
    assert.strictEqual(res.docs[0]._id.toString(), doc._id.toString());
    assert.strictEqual(res.docs[0].name, 'Carol');
    assert.strictEqual(res.docs[0].email, 'carol@example.com');
    assert.strictEqual(res.docs[0].value, undefined);
    assert.strictEqual(res.docs[0].createdAt, undefined);
  });

  it('supports raw projectionInput exclusion syntax', async function() {
    const doc = await ProjectionFieldsTest.create({
      name: 'Dave',
      email: 'dave@example.com',
      value: 321,
      createdAt: new Date('2023-01-01')
    });

    const res = await actions.Model.getDocuments({
      model: 'ProjectionFieldsTest',
      projectionInput: '-value -createdAt',
      roles: ['admin']
    });

    assert.strictEqual(res.docs.length, 1);
    assert.strictEqual(res.docs[0]._id.toString(), doc._id.toString());
    assert.strictEqual(res.docs[0].name, 'Dave');
    assert.strictEqual(res.docs[0].email, 'dave@example.com');
    assert.strictEqual(res.docs[0].value, undefined);
    assert.strictEqual(res.docs[0].createdAt, undefined);
  });
});
