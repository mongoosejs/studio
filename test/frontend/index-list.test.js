'use strict';

const assert = require('assert');
const sinon = require('sinon');

require('./setup');
const api = require('../../frontend/src/api');
const indexListComponent = require('../../frontend/src/models/index-list/index-list');

describe('index-list syncIndexes', function() {
  const { methods } = indexListComponent({ component: (_name, def) => def });
  const refreshed = { mongoDBIndexes: [{ name: 'b_1' }], diffIndexes: { toCreate: [], toDrop: [] } };
  let state;

  beforeEach(function() {
    state = {
      currentModel: 'Test',
      diffIndexes: { toCreate: [[{ b: 1 }, {}]], toDrop: ['a_1'] },
      createdIndexNames: new Set(),
      $toast: { success: sinon.stub() }
    };
    methods.openSyncIndexesModal.call(state);
    sinon.stub(api.Model, 'getIndexes').resolves(refreshed);
  });

  afterEach(function() {
    sinon.restore();
  });

  function stubStream(events, err) {
    return sinon.stub(api.Model, 'syncIndexes').callsFake(async function* () {
      yield* events;
      if (err) {
        throw err;
      }
    });
  }

  const dropped = { list: 'toDrop', position: 0, name: 'a_1', status: 'succeeded' };
  const created = { list: 'toCreate', position: 0, name: 'b_1', status: 'succeeded' };

  it('shows finished phases as complete', function() {
    const phases = {
      'scanning collection': { done: 3, total: 4 },
      'inserting keys from external sorter into index': { done: 1, total: 4 }
    };

    assert.strictEqual(methods.getPhasePercent({ status: 'inProgress', phases }, 'scanning collection'), 100);
    assert.strictEqual(methods.getPhasePercent({ status: 'inProgress', phases }, 'inserting keys from external sorter into index'), 25);
    assert.strictEqual(methods.getPhasePercent({ status: 'succeeded', phases }, 'inserting keys from external sorter into index'), 100);
  });

  it('sends the confirmed plan, even if diffIndexes changes while confirming', async function() {
    const plan = state.diffIndexes;
    const stream = stubStream([dropped, created]);
    state.diffIndexes = { toCreate: [], toDrop: [] };

    await methods.syncIndexes.call(state);

    assert.deepStrictEqual(stream.firstCall.args[0], { model: 'Test', ...plan });
  });

  it('closes the modal and refreshes indexes when every index syncs', async function() {
    stubStream([dropped, created]);

    await methods.syncIndexes.call(state);

    assert.strictEqual(state.syncPlan, null);
    assert.strictEqual(state.mongoDBIndexes, refreshed.mongoDBIndexes);
    assert.strictEqual(state.diffIndexes, refreshed.diffIndexes);
    assert.ok(state.createdIndexNames.has('b_1'));
    assert.ok(state.$toast.success.calledOnce);
  });

  it('keeps the modal open to show errors when an index fails', async function() {
    stubStream([dropped, { ...created, status: 'failed', error: 'E11000' }]);

    await methods.syncIndexes.call(state);

    assert.notStrictEqual(state.syncPlan, null);
    assert.strictEqual(state.syncStatus, 'finished');
    assert.strictEqual(state.syncEvents.toCreate[0].error, 'E11000');
    assert.strictEqual(state.diffIndexes, refreshed.diffIndexes);
    assert.ok(state.$toast.success.notCalled);
  });

  it('does not report success if the stream ends before every index finished', async function() {
    stubStream([dropped]);

    await methods.syncIndexes.call(state);

    assert.notStrictEqual(state.syncPlan, null);
    assert.strictEqual(state.syncStatus, 'finished');
    assert.ok(state.$toast.success.notCalled);
  });

  it('refreshes indexes and rethrows if the stream fails', async function() {
    stubStream([dropped], new Error('stream failed'));

    await assert.rejects(methods.syncIndexes.call(state), /stream failed/);

    assert.strictEqual(state.syncStatus, 'finished');
    assert.strictEqual(state.diffIndexes, refreshed.diffIndexes);
  });
});
