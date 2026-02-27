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

describe('Task.getTasks()', function() {
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

  it('returns empty tasks, numDocs 0, and statusCounts when no documents', async function() {
    const res = await actions.Task.getTasks({});
    assert.strictEqual(Array.isArray(res.tasks), true);
    assert.strictEqual(res.tasks.length, 0);
    assert.strictEqual(res.numDocs, 0);
    assert.strictEqual(typeof res.statusCounts, 'object');
    assert.ok(res.statusCounts.pending === 0 || res.statusCounts.pending === undefined);
  });

  it('returns tasks with projected shape (id, parameters from payload)', async function() {
    const scheduled = new Date('2025-01-15T10:00:00Z');
    await Task.create({
      name: 'myTask',
      status: 'succeeded',
      scheduledAt: scheduled,
      createdAt: scheduled,
      payload: { foo: 'bar', n: 1 }
    });

    const res = await actions.Task.getTasks({});
    assert.strictEqual(res.tasks.length, 1);
    assert.strictEqual(res.numDocs, 1);
    const t = res.tasks[0];
    assert.ok(t._id);
    assert.strictEqual(t.id.toString(), t._id.toString());
    assert.strictEqual(t.name, 'myTask');
    assert.strictEqual(t.status, 'succeeded');
    assert.deepStrictEqual(t.parameters, { foo: 'bar', n: 1 });
    assert.ok(t.scheduledAt);
  });

  it('sorts by scheduledAt descending', async function() {
    const base = new Date('2025-01-01T12:00:00Z');
    await Task.insertMany([
      { name: 'a', status: 'pending', scheduledAt: new Date(base.getTime() + 1000) },
      { name: 'b', status: 'pending', scheduledAt: base },
      { name: 'c', status: 'pending', scheduledAt: new Date(base.getTime() + 2000) }
    ]);

    const res = await actions.Task.getTasks({});
    assert.strictEqual(res.tasks.length, 3);
    assert.strictEqual(res.tasks[0].name, 'c');
    assert.strictEqual(res.tasks[1].name, 'a');
    assert.strictEqual(res.tasks[2].name, 'b');
  });

  it('filters by date range (start and end)', async function() {
    const start = new Date('2025-01-10T00:00:00Z');
    const end = new Date('2025-01-12T00:00:00Z');
    await Task.insertMany([
      { name: 'in', status: 'pending', scheduledAt: new Date('2025-01-11T12:00:00Z') },
      { name: 'before', status: 'pending', scheduledAt: new Date('2025-01-09T12:00:00Z') },
      { name: 'after', status: 'pending', scheduledAt: new Date('2025-01-12T00:00:01Z') }
    ]);

    const res = await actions.Task.getTasks({ start, end });
    assert.strictEqual(res.tasks.length, 1);
    assert.strictEqual(res.tasks[0].name, 'in');
    assert.strictEqual(res.numDocs, 1);
  });

  it('filters by start only (scheduledAt >= start)', async function() {
    const start = new Date('2025-01-10T00:00:00Z');
    await Task.insertMany([
      { name: 'in', status: 'pending', scheduledAt: new Date('2025-01-11T12:00:00Z') },
      { name: 'before', status: 'pending', scheduledAt: new Date('2025-01-09T12:00:00Z') }
    ]);

    const res = await actions.Task.getTasks({ start });
    assert.strictEqual(res.tasks.length, 1);
    assert.strictEqual(res.tasks[0].name, 'in');
    assert.strictEqual(res.numDocs, 1);
  });

  it('filters by status', async function() {
    await Task.insertMany([
      { name: 't1', status: 'succeeded', scheduledAt: new Date() },
      { name: 't2', status: 'failed', scheduledAt: new Date() },
      { name: 't3', status: 'succeeded', scheduledAt: new Date() }
    ]);

    const res = await actions.Task.getTasks({ status: 'succeeded' });
    assert.strictEqual(res.tasks.length, 2);
    assert.strictEqual(res.numDocs, 2);
    res.tasks.forEach(t => assert.strictEqual(t.status, 'succeeded'));
  });

  it('trims status before filtering', async function() {
    await Task.create({ name: 't1', status: 'failed', scheduledAt: new Date() });
    const res = await actions.Task.getTasks({ status: '  failed  ' });
    assert.strictEqual(res.tasks.length, 1);
    assert.strictEqual(res.tasks[0].status, 'failed');
  });

  it('filters by name (regex, case insensitive)', async function() {
    await Task.insertMany([
      { name: 'SendEmail', status: 'pending', scheduledAt: new Date() },
      { name: 'sendEmail', status: 'pending', scheduledAt: new Date() },
      { name: 'OtherJob', status: 'pending', scheduledAt: new Date() }
    ]);

    const res = await actions.Task.getTasks({ name: 'sendemail' });
    assert.strictEqual(res.tasks.length, 2);
    assert.strictEqual(res.numDocs, 2);
    res.tasks.forEach(t => assert.ok(/sendemail/i.test(t.name)));
  });

  it('escapes special regex characters in name', async function() {
    await Task.create({ name: 'job (x)', status: 'pending', scheduledAt: new Date() });
    const res = await actions.Task.getTasks({ name: 'job (x)' });
    assert.strictEqual(res.tasks.length, 1);
    assert.strictEqual(res.tasks[0].name, 'job (x)');
  });

  it('trims name before filtering', async function() {
    await Task.create({ name: 'TrimmedTask', status: 'pending', scheduledAt: new Date() });
    const res = await actions.Task.getTasks({ name: '  TrimmedTask  ' });
    assert.strictEqual(res.tasks.length, 1);
    assert.strictEqual(res.tasks[0].name, 'TrimmedTask');
  });

  it('applies skip and limit (pagination)', async function() {
    const base = new Date('2025-01-01T12:00:00Z');
    await Task.insertMany([
      { name: 'a', status: 'pending', scheduledAt: new Date(base.getTime() + 3000) },
      { name: 'b', status: 'pending', scheduledAt: new Date(base.getTime() + 2000) },
      { name: 'c', status: 'pending', scheduledAt: new Date(base.getTime() + 1000) }
    ]);

    const page1 = await actions.Task.getTasks({ skip: 0, limit: 2 });
    assert.strictEqual(page1.tasks.length, 2);
    assert.strictEqual(page1.numDocs, 3);
    assert.strictEqual(page1.tasks[0].name, 'a');
    assert.strictEqual(page1.tasks[1].name, 'b');

    const page2 = await actions.Task.getTasks({ skip: 2, limit: 2 });
    assert.strictEqual(page2.tasks.length, 1);
    assert.strictEqual(page2.numDocs, 3);
    assert.strictEqual(page2.tasks[0].name, 'c');
  });

  it('defaults skip to 0 and limit to 100', async function() {
    await Task.create({ name: 'one', status: 'pending', scheduledAt: new Date() });
    const res = await actions.Task.getTasks({});
    assert.strictEqual(res.tasks.length, 1);
    assert.strictEqual(res.numDocs, 1);
  });

  it('caps limit at MAX_LIMIT (2000)', async function() {
    const res = await actions.Task.getTasks({ limit: 10000 });
    assert.strictEqual(Array.isArray(res.tasks), true);
    assert.strictEqual(res.tasks.length, 0);
    assert.strictEqual(res.numDocs, 0);
  });

  it('clamps skip to non-negative', async function() {
    await Task.create({ name: 'one', status: 'pending', scheduledAt: new Date() });
    const res = await actions.Task.getTasks({ skip: -5, limit: 10 });
    assert.strictEqual(res.tasks.length, 1);
    assert.strictEqual(res.numDocs, 1);
  });

  it('includes all statuses when status not provided', async function() {
    const statuses = ['pending', 'in_progress', 'succeeded', 'failed', 'cancelled', 'unknown'];
    for (const s of statuses) {
      await Task.create({ name: s, status: s, scheduledAt: new Date() });
    }
    const res = await actions.Task.getTasks({});
    assert.strictEqual(res.tasks.length, 6);
    assert.strictEqual(res.numDocs, 6);
  });

  it('returns statusCounts for matching documents', async function() {
    await Task.insertMany([
      { name: 'a', status: 'succeeded', scheduledAt: new Date() },
      { name: 'b', status: 'succeeded', scheduledAt: new Date() },
      { name: 'c', status: 'failed', scheduledAt: new Date() }
    ]);
    const res = await actions.Task.getTasks({});
    assert.strictEqual(res.statusCounts.succeeded, 2);
    assert.strictEqual(res.statusCounts.failed, 1);
    assert.strictEqual(res.statusCounts.pending, 0);
    assert.strictEqual(res.statusCounts.cancelled, 0);
  });

  it('returns numDocs as total matching count when using pagination', async function() {
    const base = new Date('2025-01-01T12:00:00Z');
    await Task.insertMany([
      { name: 'a', status: 'pending', scheduledAt: new Date(base.getTime() + 100) },
      { name: 'b', status: 'pending', scheduledAt: new Date(base.getTime() + 200) },
      { name: 'c', status: 'pending', scheduledAt: new Date(base.getTime() + 300) }
    ]);
    const res = await actions.Task.getTasks({ skip: 1, limit: 1 });
    assert.strictEqual(res.tasks.length, 1);
    assert.strictEqual(res.numDocs, 3);
  });
});
