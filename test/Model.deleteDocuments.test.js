'use strict';

const assert = require('assert');
const { actions, connection } = require('./setup.test');

describe('Model.deleteDocuments()', function () {
  it('deletes documents by specified ids', async function () {
    const { Test } = connection.models;
    let docs = await Test.create([{ name: 'test 1' }, { name: 'test 2' }, { name: 'test 3' }]);

    await actions.Model.deleteDocuments({
      model: 'Test',
      documentIds: [docs[0]._id.toString(), docs[2]._id.toString()],
      roles: ['admin']
    });

    docs = await Test.find();
    assert.strictEqual(docs.length, 1);
    assert.strictEqual(docs[0].name, 'test 2');
  });
});
