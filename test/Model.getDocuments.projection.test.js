'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
const { actions, connection } = require('./setup.test');

describe('Model.getDocuments() projection (fields)', function() {
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

  it('returns only selected fields when fields is provided', async function() {
    const doc = await ProjectionFieldsTest.create({
      name: 'Alice',
      email: 'alice@example.com',
      value: 123,
      createdAt: new Date('2020-01-01')
    });

    const res = await actions.Model.getDocuments({
      model: 'ProjectionFieldsTest',
      fields: JSON.stringify(['name', 'email']),
      roles: ['admin']
    });

    assert.strictEqual(res.docs.length, 1);
    assert.strictEqual(res.docs[0]._id.toString(), doc._id.toString());
    assert.strictEqual(res.docs[0].name, 'Alice');
    assert.strictEqual(res.docs[0].email, 'alice@example.com');

    // Should not include unselected fields
    assert.strictEqual(res.docs[0].value, undefined);
    assert.strictEqual(res.docs[0].createdAt, undefined);
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
});

