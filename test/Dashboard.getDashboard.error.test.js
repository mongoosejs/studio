'use strict';

const assert = require('assert');
const { actions, studioConnection } = require('./setup.test');
const dashboardSchema = require('../backend/db/dashboardSchema');
const dashboardResultSchema = require('../backend/db/dashboardResultSchema');

const Dashboard = studioConnection.model('__Studio_Dashboard', dashboardSchema, 'studio__dashboards');
const DashboardResult = studioConnection.model('__Studio_DashboardResult', dashboardResultSchema, 'studio__dashboardResults');

describe('Dashboard.getDashboard() error handling', function () {
  afterEach(async function () {
    await Dashboard.deleteMany();
    await DashboardResult.deleteMany();
  });

  it('persists evaluation errors to studioConnection', async function () {
    const doc = await Dashboard.create({ title: 'Test', code: 'throw new Error("test error")' });

    const res = await actions.Dashboard.getDashboard({
      dashboardId: doc._id.toString(),
      evaluate: true,
      roles: ['dashboards']
    });

    assert.ok(res.dashboard);
    assert.deepStrictEqual(res.error, { message: 'test error' });
    assert.ok(res.dashboardResult);
    assert.strictEqual(res.dashboardResult.status, 'failed');
    assert.strictEqual(res.dashboardResult.error.message, 'test error');
  });
});
