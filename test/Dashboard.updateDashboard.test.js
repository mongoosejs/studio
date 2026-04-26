'use strict';

const assert = require('assert');
const { actions, studioConnection } = require('./setup.test');
const dashboardSchema = require('../backend/db/dashboardSchema');

const Dashboard = studioConnection.model('__Studio_Dashboard', dashboardSchema, 'studio__dashboards');

describe('Dashboard.updateDashboard()', function() {
  afterEach(async function () {
    await Dashboard.deleteMany();
  });

  it('persists empty title and description values', async function() {
    const doc = await Dashboard.create({
      title: 'Initial title',
      description: 'Initial description',
      code: 'return 42;'
    });

    const res = await actions.Dashboard.updateDashboard({
      dashboardId: doc._id.toString(),
      code: 'return 43;',
      title: '',
      description: '',
      roles: ['member']
    });

    assert.ok(res.doc);
    assert.strictEqual(res.doc.code, 'return 43;');
    assert.strictEqual(res.doc.title, '');
    assert.strictEqual(res.doc.description, '');

    const fromDb = await Dashboard.findById(doc._id).lean();
    assert.strictEqual(fromDb.title, '');
    assert.strictEqual(fromDb.description, '');
  });
});
