'use strict';

const assert = require('assert');
const sinon = require('sinon');
const { actions, studioConnection } = require('./setup.test');
const dashboardSchema = require('../backend/db/dashboardSchema');
const dashboardResultSchema = require('../backend/db/dashboardResultSchema');

const Dashboard = studioConnection.model('__Studio_Dashboard', dashboardSchema, 'studio__dashboards');
const DashboardResult = studioConnection.model('__Studio_DashboardResult', dashboardResultSchema, 'studio__dashboardResults');

describe('Dashboard.getDashboard() results', function () {
  afterEach(async function () {
    sinon.restore();
    await Dashboard.deleteMany();
    await DashboardResult.deleteMany();
  });

  it('persists successful evaluations on studioConnection', async function () {
    const dashboard = await Dashboard.create({
      title: 'Count',
      code: 'return { total: 42 };'
    });

    const res = await actions.Dashboard.getDashboard({
      dashboardId: dashboard._id.toString(),
      evaluate: true,
      roles: ['dashboards']
    });

    assert.ok(res.dashboardResult);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(res.result)), { total: 42 });
    assert.strictEqual(res.dashboardResult.status, 'completed');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(res.dashboardResult.result)), { total: 42 });

    const persisted = await DashboardResult.findById(res.dashboardResult._id).lean();
    assert.ok(persisted);
    assert.strictEqual(persisted.status, 'completed');
    assert.deepStrictEqual(persisted.result, { total: 42 });
  });

  it('returns persisted results from studioConnection', async function () {
    const dashboard = await Dashboard.create({
      title: 'Count',
      code: 'return { total: 42 };'
    });

    await DashboardResult.create({
      dashboardId: dashboard._id,
      status: 'completed',
      startedEvaluatingAt: new Date('2026-01-01T00:00:00.000Z'),
      finishedEvaluatingAt: new Date('2026-01-01T00:00:01.000Z'),
      result: { total: 7 }
    });

    const res = await actions.Dashboard.getDashboard({
      dashboardId: dashboard._id.toString(),
      evaluate: false,
      roles: ['dashboards']
    });

    assert.ok(Array.isArray(res.dashboardResults));
    assert.strictEqual(res.dashboardResults.length, 1);
    assert.deepStrictEqual(res.dashboardResults[0].result, { total: 7 });
  });

  it('merges local and mothership results in parallel for backwards compatibility', async function () {
    const dashboard = await Dashboard.create({
      title: 'Count',
      code: 'return { total: 42 };'
    });

    await DashboardResult.create({
      dashboardId: dashboard._id,
      workspaceId: dashboard._id,
      status: 'completed',
      startedEvaluatingAt: new Date('2026-01-01T00:00:00.000Z'),
      finishedEvaluatingAt: new Date('2026-01-01T00:00:01.000Z'),
      result: { total: 7 }
    });

    const fetchStub = sinon.stub(global, 'fetch').resolves({
      status: 200,
      json: async () => ({
        dashboardResults: [{
          _id: 'remote-result-1',
          status: 'completed',
          finishedEvaluatingAt: '2026-01-02T00:00:01.000Z',
          result: { total: 9 }
        }]
      })
    });

    const res = await actions.Dashboard.getDashboard({
      dashboardId: dashboard._id.toString(),
      evaluate: false,
      authorization: 'Bearer test-token',
      $workspaceId: dashboard._id.toString(),
      roles: ['dashboards']
    });

    assert.strictEqual(fetchStub.calledOnce, true);
    assert.ok(Array.isArray(res.dashboardResults));
    assert.strictEqual(res.dashboardResults.length, 2);
    assert.deepStrictEqual(res.dashboardResults.map(result => result.result), [
      { total: 9 },
      { total: 7 }
    ]);
  });
});
