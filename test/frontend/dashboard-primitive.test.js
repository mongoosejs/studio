'use strict';

const assert = require('assert');

require('./setup');

const { createSSRApp } = require('vue');
const { renderToString } = require('vue/server-renderer');

const dashboardPrimitive = require('../../frontend/src/dashboard-result/dashboard-primitive/dashboard-primitive');

describe('dashboard-primitive component', function() {
  it('renders arrays containing null without throwing', async function() {
    const app = createSSRApp({
      template: '<dashboard-primitive :value="[null]" />'
    });
    dashboardPrimitive(app);

    const html = await renderToString(app);

    assert.ok(html.includes('null'));
    assert.ok(html.includes('text-xl p-2'));
  });
});
