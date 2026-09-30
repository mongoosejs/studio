'use strict';

const assert = require('assert');
const sinon = require('sinon');

require('./setup');
const api = require('../../frontend/src/api');
const scriptComponent = require('../../frontend/src/script/script');

describe('script component', function() {
  afterEach(function() {
    sinon.restore();
  });

  it('loads a script and executes edited code in dry-run mode', async function() {
    const scriptId = '1'.repeat(24);
    const initial = { _id: scriptId, script: 'return 1;' };
    const executed = {
      ...initial,
      script: 'return 2;',
      dryRun: true,
      executionFinishedAt: new Date(),
      executionResult: { output: 2, logs: '', error: null }
    };
    sinon.stub(api.Script, 'getScript').resolves({ script: initial });
    sinon.stub(api.Script, 'executeScript').resolves({ script: executed });

    const ctx = {
      scriptId,
      status: 'loading',
      script: null,
      editedScript: '',
      isEditing: false,
      activeTab: 'code',
      selectedRunMode: 'dryRun',
      showRunDropdown: true,
      $refs: {},
      $nextTick: callback => callback(),
      $toast: { success: sinon.spy() },
      highlightCode: scriptComponent.methods.highlightCode
    };

    await scriptComponent.methods.loadScript.call(ctx);
    assert.strictEqual(ctx.script.script, 'return 1;');

    ctx.isEditing = true;
    ctx.editedScript = 'return 2;';
    await scriptComponent.methods.executeScript.call(ctx);

    assert.deepStrictEqual(api.Script.executeScript.firstCall.args[0], {
      scriptId,
      script: 'return 2;',
      dryRun: true
    });
    assert.strictEqual(ctx.script, executed);
    assert.strictEqual(ctx.activeTab, 'output');
    assert.strictEqual(ctx.isEditing, false);
  });
});
