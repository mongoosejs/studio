'use strict';

const assert = require('assert');
const baseApp = require('./setup');
const { createSSRApp } = require('vue');
const { renderToString } = require('vue/server-renderer');
const sinon = require('sinon');

const api = require('../../frontend/src/api');
const dashboard = require('../../frontend/src/dashboard/dashboard');

describe('dashboard component', function() {
  afterEach(function () {
    sinon.restore();
  });

  it('does not throw when edit-dashboard emits an error payload', async function() {
    const toast = { error: sinon.spy() };
    const consoleError = sinon.stub(console, 'error');
    const ctx = {
      $toast: toast,
      evaluateDashboard: sinon.stub().resolves(),
      code: 'before',
      title: 'before',
      description: 'before'
    };

    await dashboard.methods.updateCode.call(ctx, {
      error: { message: 'Update failed' }
    });

    assert.strictEqual(ctx.code, 'before');
    assert.strictEqual(ctx.title, 'before');
    assert.strictEqual(ctx.description, 'before');
    assert.strictEqual(ctx.evaluateDashboard.called, false);
    assert.strictEqual(toast.error.calledOnceWithExactly('Update failed'), true);
    assert.strictEqual(consoleError.calledOnce, true);
  });

  it('handles missing dashboardResults in API response', async function () {
    const dashboardId = '1'.repeat(24);
    sinon.stub(api.Dashboard, 'getDashboard').callsFake(() => Promise.resolve({
      dashboard: {
        _id: dashboardId,
        code: 'console.log("Hello world")',
        title: 'Hello world'
      }
    }));

    const app = createSSRApp({
      template: `<dashboard :dashboardId="'${dashboardId}'" />`,
      extends: baseApp
    });
    app.component('dashboard', dashboard);
    app.component('modal', {});
    app.component('edit-dashboard', {});
    app.component('dashboard-result', {});
    app.component('async-button', {});

    await renderToString(app);
    const instance = appInstance.$options.$children[0];

    await instance.loadInitial();

    assert.strictEqual(instance.shouldEvaluateDashboard(), true);
    assert.strictEqual(api.Dashboard.getDashboard.getCalls().length, 2);
    assert.deepStrictEqual(api.Dashboard.getDashboard.getCall(0).args[0], {
      dashboardId,
      evaluate: false
    });
    assert.deepStrictEqual(api.Dashboard.getDashboard.getCall(1).args[0], {
      dashboardId,
      evaluate: true
    });
  });
});
