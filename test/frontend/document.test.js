'use strict';

const assert = require('assert');
const sinon = require('sinon');

require('./setup');
const documentComponent = require('../../frontend/src/document/document');
const createDocumentComponent = require('../../frontend/src/create-document/create-document');
const api = require('../../frontend/src/api');

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
    const clock = sinon.useFakeTimers(new Date('2026-03-22T15:04:05Z'));
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

    try {
      await componentDef.methods.requestAiSuggestion.call(state);
      const params = streamStub.firstCall.args[0];
      assert.strictEqual(params.currentDateTime, new Date().toString());
    } finally {
      clock.restore();
    }
  });
});
