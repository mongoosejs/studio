'use strict';

const assert = require('assert');
const sinon = require('sinon');

require('./setup');
const documentComponent = require('../../frontend/src/document/document');
const createDocumentComponent = require('../../frontend/src/create-document/create-document');
const detailArrayComponent = require('../../frontend/src/detail-array/detail-array');
const api = require('../../frontend/src/api');
const time = require('time-commando');

describe('document component keyboard shortcuts', function() {
  afterEach(function() {
    sinon.restore();
  });

  it('opens save confirmation on ctrl+s while editing', function() {
    const componentDef = documentComponent({ component: (_name, def) => def });
    const state = {
      editting: true,
      canManipulate: true,
      shouldShowConfirmModal: false
    };
    let prevented = false;

    componentDef.methods.handleSaveShortcut.call(state, {
      ctrlKey: true,
      metaKey: false,
      key: 's',
      preventDefault: () => {
        prevented = true;
      }
    });

    assert.strictEqual(prevented, true);
    assert.strictEqual(state.shouldShowConfirmModal, true);
  });

  it('ignores ctrl+s when not editing', function() {
    const componentDef = documentComponent({ component: (_name, def) => def });
    const state = {
      editting: false,
      canManipulate: true,
      shouldShowConfirmModal: false
    };
    let prevented = false;

    componentDef.methods.handleSaveShortcut.call(state, {
      ctrlKey: true,
      metaKey: false,
      key: 's',
      preventDefault: () => {
        prevented = true;
      }
    });

    assert.strictEqual(prevented, false);
    assert.strictEqual(state.shouldShowConfirmModal, false);
  });

  it('passes the user current date time when requesting an AI document suggestion', async function() {
    sinon.stub(time, 'now').returns(new Date(2026, 2, 22, 15, 4, 5));
    const componentDef = createDocumentComponent({ component: (_name, def) => def });
    const streamStub = sinon.stub(api.Model, 'streamChatMessage').callsFake(async function* () {
      yield { textPart: '{ name: "test" }' };
    });

    const state = {
      aiStreaming: false,
      aiPrompt: 'Add a name field',
      documentData: '{\n}',
      aiSuggestion: '',
      aiOriginalDocument: '',
      aiSuggestionReady: false,
      currentModel: 'User',
      $refs: {
        codeEditor: {
          setValue: () => {}
        }
      },
      $toast: {
        error: () => {}
      }
    };

    await componentDef.methods.requestAiSuggestion.call(state);
    const params = streamStub.firstCall.args[0];
    assert.strictEqual(params.currentDateTime, '2026-03-22T15:04:05');
  });
});

describe('detail-array component', function() {
  function computeRows(componentDef, state) {
    state.arraySearchNormalized = componentDef.computed.arraySearchNormalized.call(state);
    state.filteredArrayRows = componentDef.computed.filteredArrayRows.call(state);
    state.shouldLimitRows = componentDef.computed.shouldLimitRows.call(state);
    state.displayedArrayRows = componentDef.computed.displayedArrayRows.call(state);
    state.remainingArrayCount = componentDef.computed.remainingArrayCount.call(state);
  }

  it('searches the full array even when display is truncated', function() {
    const componentDef = detailArrayComponent({ component: (_name, def) => def });
    const state = {
      arrayValue: [
        { name: 'first' },
        { name: 'second' },
        { name: 'hidden target' }
      ],
      arraySearchQuery: 'target',
      truncate: true,
      initialLimit: 2,
      isExpanded: false
    };

    computeRows(componentDef, state);

    assert.deepStrictEqual(state.displayedArrayRows.map(row => row.index), [2]);
    assert.strictEqual(state.remainingArrayCount, 0);
  });

  it('limits displayed rows only when there is no array search', function() {
    const componentDef = detailArrayComponent({ component: (_name, def) => def });
    const state = {
      arrayValue: [
        { name: 'first' },
        { name: 'second' },
        { name: 'third' }
      ],
      arraySearchQuery: '',
      truncate: true,
      initialLimit: 2,
      isExpanded: false
    };

    computeRows(componentDef, state);

    assert.deepStrictEqual(state.displayedArrayRows.map(row => row.index), [0, 1]);
    assert.strictEqual(state.remainingArrayCount, 1);
  });
});
