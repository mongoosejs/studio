'use strict';

const Archetype = require('archetype');
const { setTimeout: sleep } = require('timers/promises');
const authorize = require('../../authorize');

const progressIntervalMS = 1000;

const SyncIndexesParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  // `[key, options]` tuples, same format as `diffIndexes().toCreate`
  toCreate: {
    $type: [[Object]]
  },
  toDrop: {
    $type: ['string']
  },
  roles: {
    $type: ['string']
  }
}).compile('SyncIndexesParams');

module.exports = ({ db }) => async function* syncIndexes(params) {
  const { model, toCreate = [], toDrop = [], roles } = new SyncIndexesParams(params);

  await authorize('Model.syncIndexes', roles);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  // Keep going when an index fails: the remaining indexes don't depend on it, and
  // stopping would leave them unsynced after some indexes were already dropped.
  // Drop first, like Mongoose's `syncIndexes()`: an index with changed options is in
  // both lists, and MongoDB won't create it while the old version still exists.
  for (const [position, name] of toDrop.entries()) {
    const event = { list: 'toDrop', position, name };
    yield { ...event, status: 'inProgress' };
    yield { ...event, ...await getResult(Model.collection.dropIndex(name)) };
  }

  for (const [position, [key, options]] of toCreate.entries()) {
    const name = options?.name ?? Object.keys(key).map(field => `${field}_${key[field]}`).join('_');
    const event = { list: 'toCreate', position, name };
    yield { ...event, status: 'inProgress' };

    const phases = {};
    const build = getResult(Model.collection.createIndex(key, { ...options, name }));
    let result = await Promise.race([build, sleep(progressIntervalMS)]);
    while (result == null) {
      // Best effort: only MongoDB 8.2 and later report progress on the user's own ops.
      // Progress restarts for each build phase, and which phases run depends on the build.
      const [op] = await Model.db.getClient().db('admin').aggregate([
        { $currentOp: { allUsers: false } },
        {
          $match: {
            ns: `${Model.db.name}.${Model.collection.name}`,
            'command.indexes.name': name,
            progress: { $exists: true }
          }
        },
        { $limit: 1 },
        { $project: { _id: 0, progress: 1, msg: 1 } }
      ]).toArray().catch(() => []);
      if (op != null) {
        // `msg` looks like "Index Build: scanning collection Index Build: scanning collection: 1/2 50%"
        phases[op.msg.replace(/^Index Build: (.*?)(?:: \d+\/\d+ \d+%| Index Build: .*)$/, '$1')] = op.progress;
      }
      // Yield even without progress, otherwise proxies can drop the idle connection
      // during long builds.
      yield { ...event, status: 'inProgress', phases: { ...phases } };
      result = await Promise.race([build, sleep(progressIntervalMS)]);
    }
    yield { ...event, ...result, phases };
  }
};

function getResult(promise) {
  return promise.then(
    () => ({ status: 'succeeded' }),
    err => ({ status: 'failed', error: err.message })
  );
}

module.exports.paramsType = SyncIndexesParams;
module.exports.tags = ['destructive'];
module.exports.mcp = false;
