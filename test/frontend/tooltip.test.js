'use strict';

const assert = require('assert');

require('./setup');
const tooltip = require('../../frontend/src/tooltip/tooltip');

describe('tooltip', function() {
  it('opens on hover or focus and stays open after a tap', function() {
    const componentDef = tooltip({ component: (_name, def) => def });
    const state = createState(componentDef);

    componentDef.methods.show.call(state);
    assert.strictEqual(state.isOpen, true);

    componentDef.methods.hideUnlessPinned.call(state);
    assert.strictEqual(state.isOpen, false);

    componentDef.methods.toggle.call(state);
    assert.strictEqual(state.isPinned, true);
    assert.strictEqual(state.isOpen, true);

    componentDef.methods.hideUnlessPinned.call(state);
    assert.strictEqual(state.isOpen, true);
  });

  it('closes a pinned tooltip on the next tap', function() {
    const componentDef = tooltip({ component: (_name, def) => def });
    const state = createState(componentDef);

    componentDef.methods.toggle.call(state);
    componentDef.methods.toggle.call(state);

    assert.strictEqual(state.isPinned, false);
    assert.strictEqual(state.isOpen, false);
  });
});

function createState(componentDef) {
  return {
    isOpen: false,
    isPinned: false,
    tooltipStyle: {},
    show: componentDef.methods.show,
    hide: componentDef.methods.hide,
    $nextTick() {}
  };
}
