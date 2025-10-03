'use strict';

const assert = require('assert');
const { connection } = require('./setup.test');
const dashboardSchema = require('../backend/db/dashboardSchema');

const Dashboard = connection.model('__Studio_Dashboard', dashboardSchema, 'studio__dashboards');

describe('Dashboard.evaluate() ObjectId', function() {
  afterEach(async function() {
    await Dashboard.deleteMany();
  });

  it('exposes ObjectId in sandbox', async function() {
    const doc = await Dashboard.create({ title: 'test', code: 'return { id: new ObjectId() };' });
    const res = await doc.evaluate();
    assert.ok(res.id);
    assert.strictEqual(res.id.constructor.name, 'ObjectId');
  });
});

