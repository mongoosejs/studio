'use strict';

const assert = require('assert');

require('./setup');

const { createSSRApp } = require('vue');
const { renderToString } = require('vue/server-renderer');

const dashboardPrimitive = require('../../frontend/src/dashboard-result/dashboard-primitive/dashboard-primitive');
const dashboardResult = require('../../frontend/src/dashboard-result/dashboard-result');

describe('dashboard-result component', function() {
  it('renders array results containing null without throwing', async function() {
    const app = createSSRApp({
      template: '<dashboard-result :result="[null]" />'
    });
    dashboardPrimitive(app);
    dashboardResult(app);

    const html = await renderToString(app);

    assert.ok(html.includes('bg-surface'));
    assert.ok(html.includes('text-xl p-2'));
    assert.ok(html.includes('text-content-tertiary'));
    assert.ok(html.includes('>null</div>'));
  });
});
