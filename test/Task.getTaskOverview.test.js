'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
const { actions, connection } = require('./setup.test');

const taskSchema = new mongoose.Schema({
  name: String,
  status: String,
  scheduledAt: Date,
  createdAt: Date,
  startedAt: Date,
  completedAt: Date,
  error: String,
  payload: mongoose.Schema.Types.Mixed
}, { collection: 'tasks' });

let Task;

describe('Task.getTaskOverview()', function() {
  before(function() {
    try {
      Task = connection.model('Task');
    } catch (e) {
      Task = connection.model('Task', taskSchema);
    }
  });

  afterEach(async function() {
    await Task.deleteMany();
  });

  it('returns empty statusCounts and tasksByName when no documents', async function() {
    const res = await actions.Task.getTaskOverview({});
    assert.strictEqual(typeof res.statusCounts, 'object');
    assert.ok(res.statusCounts.pending === 0 || res.statusCounts.pending === undefined);
    assert.ok(res.statusCounts.succeeded === 0 || res.statusCounts.succeeded === undefined);
    assert.ok(res.statusCounts.failed === 0 || res.statusCounts.failed === undefined);
    assert.ok(res.statusCounts.cancelled === 0 || res.statusCounts.cancelled === undefined);
    assert.strictEqual(Array.isArray(res.tasksByName), true);
    assert.strictEqual(res.tasksByName.length, 0);
  });

  it('aggregates statusCounts correctly', async function() {
    const base = new Date('2025-01-15T10:00:00Z');
    await Task.insertMany([
      { name: 'a', status: 'pending', scheduledAt: base },
      { name: 'b', status: 'pending', scheduledAt: base },
      { name: 'c', status: 'succeeded', scheduledAt: base },
      { name: 'd', status: 'failed', scheduledAt: base }
    ]);

    const res = await actions.Task.getTaskOverview({});
    assert.strictEqual(res.statusCounts.pending, 2);
    assert.strictEqual(res.statusCounts.succeeded, 1);
    assert.strictEqual(res.statusCounts.failed, 1);
    assert.strictEqual(res.statusCounts.cancelled, 0);
  });

  it('returns tasksByName with name, totalCount, lastRun, statusCounts', async function() {
    const d1 = new Date('2025-01-10T10:00:00Z');
    const d2 = new Date('2025-01-12T10:00:00Z');
    await Task.insertMany([
      { name: 'SendEmail', status: 'succeeded', scheduledAt: d1 },
      { name: 'SendEmail', status: 'failed', scheduledAt: d2 },
      { name: 'Cleanup', status: 'pending', scheduledAt: d1 }
    ]);

    const res = await actions.Task.getTaskOverview({});
    assert.strictEqual(res.tasksByName.length, 2);

    const sendEmail = res.tasksByName.find(g => g.name === 'SendEmail');
    assert.ok(sendEmail);
    assert.strictEqual(sendEmail.totalCount, 2);
    assert.ok(sendEmail.lastRun);
    assert.strictEqual(new Date(sendEmail.lastRun).getTime(), d2.getTime());
    assert.strictEqual(sendEmail.statusCounts.succeeded, 1);
    assert.strictEqual(sendEmail.statusCounts.failed, 1);
    assert.strictEqual(sendEmail.statusCounts.pending, 0);
    assert.strictEqual(sendEmail.statusCounts.cancelled, 0);

    const cleanup = res.tasksByName.find(g => g.name === 'Cleanup');
    assert.ok(cleanup);
    assert.strictEqual(cleanup.totalCount, 1);
    assert.strictEqual(cleanup.statusCounts.pending, 1);
  });

  it('sorts tasksByName by name', async function() {
    await Task.insertMany([
      { name: 'Zebra', status: 'pending', scheduledAt: new Date() },
      { name: 'Alpha', status: 'pending', scheduledAt: new Date() },
      { name: 'Middle', status: 'pending', scheduledAt: new Date() }
    ]);

    const res = await actions.Task.getTaskOverview({});
    assert.strictEqual(res.tasksByName[0].name, 'Alpha');
    assert.strictEqual(res.tasksByName[1].name, 'Middle');
    assert.strictEqual(res.tasksByName[2].name, 'Zebra');
  });

  it('filters by date range', async function() {
    const start = new Date('2025-01-10T00:00:00Z');
    const end = new Date('2025-01-12T00:00:00Z');
    await Task.insertMany([
      { name: 'in', status: 'succeeded', scheduledAt: new Date('2025-01-11T12:00:00Z') },
      { name: 'out', status: 'succeeded', scheduledAt: new Date('2025-01-09T12:00:00Z') }
    ]);

    const res = await actions.Task.getTaskOverview({ start, end });
    assert.strictEqual(res.statusCounts.succeeded, 1);
    assert.strictEqual(res.tasksByName.length, 1);
    assert.strictEqual(res.tasksByName[0].name, 'in');
  });

  it('filters by start only', async function() {
    const start = new Date('2025-01-10T00:00:00Z');
    await Task.insertMany([
      { name: 'in', status: 'pending', scheduledAt: new Date('2025-01-11T12:00:00Z') },
      { name: 'out', status: 'pending', scheduledAt: new Date('2025-01-09T12:00:00Z') }
    ]);

    const res = await actions.Task.getTaskOverview({ start });
    assert.strictEqual(res.statusCounts.pending, 1);
    assert.strictEqual(res.tasksByName.length, 1);
    assert.strictEqual(res.tasksByName[0].name, 'in');
  });

  it('filters by status', async function() {
    await Task.insertMany([
      { name: 'a', status: 'succeeded', scheduledAt: new Date() },
      { name: 'b', status: 'failed', scheduledAt: new Date() },
      { name: 'c', status: 'succeeded', scheduledAt: new Date() }
    ]);

    const res = await actions.Task.getTaskOverview({ status: 'succeeded' });
    assert.strictEqual(res.statusCounts.succeeded, 2);
    assert.strictEqual(res.statusCounts.failed, 0);
    assert.strictEqual(res.tasksByName.length, 2);
    res.tasksByName.forEach(g => assert.strictEqual(g.name === 'a' || g.name === 'c', true));
  });

  it('filters by name (case insensitive regex)', async function() {
    await Task.insertMany([
      { name: 'SendEmail', status: 'pending', scheduledAt: new Date() },
      { name: 'sendEmail', status: 'pending', scheduledAt: new Date() },
      { name: 'OtherJob', status: 'pending', scheduledAt: new Date() }
    ]);

    const res = await actions.Task.getTaskOverview({ name: 'sendemail' });
    assert.strictEqual(res.tasksByName.length, 2);
    res.tasksByName.forEach(g => assert.ok(/sendemail/i.test(g.name)));
  });

  it('trims status and name before filtering', async function() {
    await Task.create({ name: 'TrimmedTask', status: 'failed', scheduledAt: new Date() });
    const res = await actions.Task.getTaskOverview({ status: '  failed  ', name: '  TrimmedTask  ' });
    assert.strictEqual(res.statusCounts.failed, 1);
    assert.strictEqual(res.tasksByName.length, 1);
    assert.strictEqual(res.tasksByName[0].name, 'TrimmedTask');
  });

  it('includes unknown status in statusCounts', async function() {
    await Task.create({ name: 'x', status: 'unknown', scheduledAt: new Date() });
    const res = await actions.Task.getTaskOverview({});
    assert.strictEqual(res.tasksByName.length, 1);
    assert.strictEqual(res.tasksByName[0].name, 'x');
    assert.strictEqual(res.tasksByName[0].totalCount, 1);
    assert.strictEqual(res.statusCounts.unknown, 1);
  });

  it('returns empty overview when filters match no documents', async function() {
    await Task.create({ name: 'OnlyTask', status: 'succeeded', scheduledAt: new Date('2025-01-15T10:00:00Z') });
    const start = new Date('2020-01-01T00:00:00Z');
    const end = new Date('2020-01-02T00:00:00Z');
    const res = await actions.Task.getTaskOverview({ start, end });
    assert.strictEqual(res.tasksByName.length, 0);
    assert.ok(res.statusCounts.succeeded === 0 || res.statusCounts.succeeded === undefined);
  });
});
