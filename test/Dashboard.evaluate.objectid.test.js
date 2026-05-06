'use strict';

const assert = require('assert');
const MongooseStudioChartColors = require('../backend/constants/mongooseStudioChartColors');
const { actions, connection, studioConnection } = require('./setup.test');
const dashboardSchema = require('../backend/db/dashboardSchema');

const Dashboard = studioConnection.model('__Studio_Dashboard', dashboardSchema, 'studio__dashboards');
const Test = connection.model('Test');

describe('Dashboard.getDashboard() evaluation sandbox', function() {
  afterEach(async function() {
    await Dashboard.deleteMany();
    await Test.deleteMany();
  });

  it('exposes ObjectId in sandbox', async function() {
    const doc = await Dashboard.create({ title: 'test', code: 'return { id: new ObjectId() };' });
    const res = await actions.Dashboard.getDashboard({
      dashboardId: doc._id.toString(),
      evaluate: true,
      roles: ['dashboards']
    });
    assert.ok(res.result.id);
    assert.strictEqual(res.result.id.constructor.name, 'ObjectId');
  });

  it('exposes MongooseStudioChartColors in sandbox', async function() {
    const doc = await Dashboard.create({
      title: 'test',
      code: 'return { colors: MongooseStudioChartColors };'
    });
    const res = await actions.Dashboard.getDashboard({
      dashboardId: doc._id.toString(),
      evaluate: true,
      roles: ['dashboards']
    });
    assert.deepStrictEqual(res.result.colors, MongooseStudioChartColors);
  });

  it('evaluates dashboard code against the app db instead of studioConnection', async function() {
    await Test.create({ name: 'from app db' });
    const doc = await Dashboard.create({
      title: 'test',
      code: `
        const Test = db.model('Test');
        const doc = await Test.findOne();
        return { name: doc.name };
      `
    });

    const res = await actions.Dashboard.getDashboard({
      dashboardId: doc._id.toString(),
      evaluate: true,
      roles: ['dashboards']
    });

    assert.deepStrictEqual(JSON.parse(JSON.stringify(res.result)), { name: 'from app db' });
  });
});
