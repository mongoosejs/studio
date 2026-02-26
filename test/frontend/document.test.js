'use strict';

const assert = require('assert');

const documentComponent = require('../../frontend/src/document/document');

describe('document component keyboard shortcuts', function() {
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
});
