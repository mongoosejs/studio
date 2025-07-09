'use strict';

const assert = require('assert');
const { actions, connection } = require('./setup.test');

describe('Model.updateDocument()', function () {
  it('updates a document by specified id', async function () {
    const { Test } = connection.models;
    let docs = await Test.create([{ name: 'test 1' }, { name: 'test 2' }, { name: 'test 3' }]);

    await actions.Model.updateDocument({
      model: 'Test',
      _id: docs[1]._id.toString(),
      update: { name: 'updated test 2' },
      roles: ['admin']
    });

    docs = await Test.find();
    assert.strictEqual(docs.length, 3);
    assert.deepStrictEqual(docs.map(doc => doc.name).sort(), ['test 1', 'test 3', 'updated test 2']);
  });
});
