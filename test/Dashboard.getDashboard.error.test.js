'use strict';

const assert = require('assert');
const { actions, connection } = require('./setup.test');
const dashboardSchema = require('../backend/db/dashboardSchema');

// Define the dashboard model on the main connection
const Dashboard = connection.model('__Studio_Dashboard', dashboardSchema, 'studio__dashboards');

describe('Dashboard.getDashboard() error handling', function () {
  afterEach(async function () {
    await Dashboard.deleteMany();
  });

  it('handles errors from startDashboardEvaluate', async function () {
    const doc = await Dashboard.create({ title: 'Test', code: 'return 42;' });

    const originalFetch = global.fetch;
    global.fetch = () => Promise.reject(new Error('start error'));
    try {
      const res = await actions.Dashboard.getDashboard({
        dashboardId: doc._id.toString(),
        evaluate: true,
        roles: ['dashboards']
      });

      assert.ok(res.dashboard);
      assert.deepStrictEqual(res.error, { message: 'start error' });
    } finally {
      global.fetch = originalFetch;
    }
  });
});
