'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
const { actions, connection } = require('./setup.test');

describe('Model.getDocuments() sort', function() {
  const AgeTest = connection.model('AgeTest', new mongoose.Schema({ age: Number }));

  afterEach(async function() {
    await AgeTest.deleteMany();
  });

  it('includes _id in sort to break ties', async function() {
    const docs = await AgeTest.create([{ age: 1 }, { age: 1 }, { age: 1 }]);

    const res = await actions.Model.getDocuments({
      model: 'AgeTest',
      sort: { age: 1 },
      roles: ['admin']
    });

    assert.strictEqual(res.docs.length, 3);
    // Expect docs sorted by age ascending and _id descending
    const ids = docs.map(d => d._id.toString()).sort().reverse();
    const resIds = res.docs.map(d => d._id.toString());
    assert.deepStrictEqual(resIds, ids);
  });
});
