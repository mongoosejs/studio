'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
const { actions, connection } = require('./setup.test');

describe('Model.getSuggestedProjection()', function() {
  const SuggestedProjectionTest = connection.model(
    'SuggestedProjectionTest',
    new mongoose.Schema({
      name: { type: String, required: true },
      email: { type: String, unique: true, default: 'example@example.com' },
      value: Number,
      createdAt: Date,
      active: Boolean,
      userId: mongoose.Schema.Types.ObjectId
    }, { _id: false })
  );

  afterEach(async function() {
    await SuggestedProjectionTest.deleteMany();
  });

  it('prioritizes query fields when filter matches a string field', async function() {
    const res = await actions.Model.getSuggestedProjection({
      model: 'SuggestedProjectionTest',
      searchText: '{ name: "alpha" }',
      roles: ['admin']
    });

    assert.deepStrictEqual(res.suggestedFields, [
      'name',
      'email',
      'value',
      'createdAt',
      'active',
      'userId'
    ]);
  });

  it('moves the queried string field ahead of other strings', async function() {
    const res = await actions.Model.getSuggestedProjection({
      model: 'SuggestedProjectionTest',
      searchText: '{ email: "alpha@example.com" }',
      roles: ['admin']
    });

    assert.deepStrictEqual(res.suggestedFields, [
      'email',
      'name',
      'value',
      'createdAt',
      'active',
      'userId'
    ]);
  });

  it('does not boost fields when filter uses only Mongo operators', async function() {
    const res = await actions.Model.getSuggestedProjection({
      model: 'SuggestedProjectionTest',
      searchText: '{ $or: [ { name: "alpha" }, { email: "beta@example.com" } ] }',
      roles: ['admin']
    });

    // $or is a Mongo operator key, so getFieldsFromFilter will ignore it.
    assert.deepStrictEqual(res.suggestedFields, [
      'name',
      'email',
      'value',
      'createdAt',
      'active',
      'userId'
    ]);
  });
});

