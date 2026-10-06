'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

const { actions, connection, options, studioConnection } = require('./setup.test');

describe('Script.executeScript()', function() {
  let Script;
  let Test;

  before(function() {
    Script = studioConnection.model('__Studio_Script');
    Test = connection.model('Test');
  });

  afterEach(async function() {
    await Script.deleteMany();
  });

  it('creates a script for later execution', async function() {
    const userId = new mongoose.Types.ObjectId();
    const source = 'console.log("ran"); return 42;';

    options.workspace = { baseUrl: 'https://example.com/studio/' };
    const { script, url } = await actions.Script.createScript({
      initiatedById: userId,
      script: source,
      roles: ['member']
    });
    delete options.workspace;

    assert.strictEqual(url, `https://example.com/studio/#/script/${script._id}`);
    assert.strictEqual(script.script, source);
    assert.strictEqual(script.userId.toString(), userId.toString());
    assert.strictEqual(script.dryRun, undefined);
    assert.strictEqual(script.executionResult, undefined);
    assert.strictEqual(script.executionStartedAt, undefined);
    assert.strictEqual(script.executionFinishedAt, undefined);

    const loaded = await actions.Script.getScript({
      initiatedById: userId,
      scriptId: script._id,
      roles: ['member']
    });
    assert.strictEqual(loaded.script.script, source);

    const result = await actions.Script.executeScript({
      initiatedById: userId,
      scriptId: script._id,
      script: 'console.log("edited"); return 43;',
      dryRun: false,
      roles: ['member']
    });

    assert.strictEqual(result.script.script, 'console.log("edited"); return 43;');
    assert.strictEqual(result.script.executionResult.output, 43);
    assert.strictEqual(result.script.executionResult.logs, 'edited');
    assert.strictEqual(result.script.executionResult.error, null);
    assert.strictEqual(result.script.dryRun, false);
    assert.ok(result.script.executionStartedAt instanceof Date);
    assert.ok(result.script.executionFinishedAt instanceof Date);
    assert.ok(result.script.executionFinishedAt >= result.script.executionStartedAt);

    const persisted = await Script.findById(script._id).lean().orFail();
    assert.strictEqual(persisted.script, 'console.log("edited"); return 43;');
    assert.strictEqual(persisted.executionResult.output, 43);
    assert.strictEqual(persisted.userId.toString(), userId.toString());
  });

  it('rolls back dry-run writes and records dryRun', async function() {
    const { script } = await actions.Script.createScript({
      script: 'await db.models.Test.create({ name: "dry run" }); return "ok";',
      roles: ['admin']
    });
    const result = await actions.Script.executeScript({
      scriptId: script._id,
      dryRun: true,
      roles: ['admin']
    });

    assert.strictEqual(result.script.dryRun, true);
    assert.strictEqual(result.script.executionResult.output, 'ok');
    assert.strictEqual(await Test.countDocuments({ name: 'dry run' }), 0);

    const executed = await actions.Script.executeScript({
      scriptId: script._id,
      dryRun: false,
      roles: ['admin']
    });

    assert.strictEqual(executed.script.dryRun, false);
    assert.strictEqual(await Test.countDocuments({ name: 'dry run' }), 1);
  });

  it('stores execution errors', async function() {
    const { script: createdScript } = await actions.Script.createScript({
      script: 'console.log("before failure"); throw new Error("failed");',
      roles: ['owner']
    });

    await assert.rejects(
      actions.Script.executeScript({
        scriptId: createdScript._id,
        roles: ['owner']
      }),
      /Script execution failed: failed/
    );

    const script = await Script.findOne().lean().orFail();
    assert.strictEqual(script.executionResult.output, null);
    assert.strictEqual(script.executionResult.logs, 'before failure');
    assert.strictEqual(script.executionResult.error, 'failed');
    assert.ok(script.executionStartedAt instanceof Date);
    assert.ok(script.executionFinishedAt instanceof Date);
  });
});
