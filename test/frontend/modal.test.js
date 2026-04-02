'use strict';

const assert = require('assert');

require('./setup');
const modalComponent = require('../../frontend/src/modal/modal');

describe('modal component escape handling', function() {
  it('clicks the close button for the top-most modal when escape is pressed', function() {
    const componentDef = modalComponent({ component: (_name, def) => def });

    let closeClicked = false;
    const closeButton = {
      click: () => {
        closeClicked = true;
      }
    };

    const currentMask = {
      querySelector: selector => {
        if (selector === '.modal-exit, [data-modal-close]') {
          return closeButton;
        }

        return null;
      }
    };

    global.document = {
      querySelectorAll: () => [currentMask]
    };

    componentDef.methods.onEscape.call({ $el: currentMask }, { key: 'Escape' });

    assert.strictEqual(closeClicked, true);
  });

  it('does not click close for non-top-most modals', function() {
    const componentDef = modalComponent({ component: (_name, def) => def });

    let closeClicked = false;
    const closeButton = {
      click: () => {
        closeClicked = true;
      }
    };

    const currentMask = {
      querySelector: selector => {
        if (selector === '.modal-exit, [data-modal-close]') {
          return closeButton;
        }

        return null;
      }
    };

    const otherMask = {
      querySelector: () => null
    };

    global.document = {
      querySelectorAll: () => [currentMask, otherMask]
    };

    componentDef.methods.onEscape.call({ $el: currentMask }, { key: 'Escape' });

    assert.strictEqual(closeClicked, false);
  });
});
