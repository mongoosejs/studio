'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
const { actions, studioConnection } = require('./setup.test');
const dashboardSchema = require('../backend/db/dashboardSchema');

const Dashboard = studioConnection.model('__Studio_Dashboard', dashboardSchema, 'studio__dashboards');

describe('Dashboard.getDashboards()', function() {
  afterEach(async function() {
    await Dashboard.deleteMany();
  });

  it('returns newest dashboards first with stored evaluation time', async function() {
    const older = await Dashboard.create({
      title: 'Older',
      description: 'First dashboard',
      code: 'return 1;',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    });
    const newer = await Dashboard.create({
      title: 'Newer',
      description: 'Second dashboard',
      code: 'return 2;',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      lastEvaluatedAt: new Date('2026-01-04T00:00:01.000Z')
    });

    const res = await actions.Dashboard.getDashboards({ roles: ['dashboards'] });

    assert.deepStrictEqual(res.dashboards.map(dashboard => dashboard.title), ['Newer', 'Older']);
    assert.strictEqual(
      new Date(res.dashboards[0].lastEvaluatedAt).toISOString(),
      '2026-01-04T00:00:01.000Z'
    );
    assert.strictEqual(res.dashboards[1].lastEvaluatedAt, undefined);
    assert.strictEqual(older.title, 'Older');
  });

  it('derives createdAt from _id for legacy dashboards', async function() {
    const dashboard = await Dashboard.create({
      title: 'Legacy',
      code: 'return 1;'
    });
    await Dashboard.collection.updateOne({ _id: dashboard._id }, { $unset: { createdAt: 1 } });

    const res = await actions.Dashboard.getDashboards({ roles: ['dashboards'] });

    assert.strictEqual(res.dashboards.length, 1);
    assert.strictEqual(
      new Date(res.dashboards[0].createdAt).toISOString(),
      dashboard._id.getTimestamp().toISOString()
    );
  });

  it('stores the creating user id when creating a dashboard', async function() {
    const userId = new mongoose.Types.ObjectId();

    const res = await actions.Dashboard.createDashboard({
      title: 'Created By Test',
      code: 'return 1;',
      initiatedById: userId,
      initiatedBy: {
        name: 'Jane Doe',
        email: 'jane@example.com'
      },
      roles: ['member']
    });

    assert.strictEqual(res.dashboard.createdById.toString(), userId.toString());
    assert.deepStrictEqual(res.dashboard.createdBy.toObject(), {
      name: 'Jane Doe',
      email: 'jane@example.com'
    });
  });
});
