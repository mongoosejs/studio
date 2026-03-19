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

  it('returns schema-based suggested fields (no searchText boosting)', async function() {
    const res = await actions.Model.getSuggestedProjection({
      model: 'SuggestedProjectionTest',
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
});

