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

describe('Task.getTasksOverTime()', function() {
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

  it('returns empty array when no tasks exist', async function() {
    const res = await actions.Task.getTasksOverTime({});
    assert.strictEqual(Array.isArray(res), true);
    assert.strictEqual(res.length, 0);
  });

  it('groups tasks into buckets by scheduledAt', async function() {
    const bucketSizeMs = 5 * 60 * 1000; // 5 minutes
    const t1 = new Date('2025-01-15T10:00:00Z');
    const t2 = new Date('2025-01-15T10:02:00Z'); // same bucket as t1
    const t3 = new Date('2025-01-15T10:07:00Z'); // different bucket

    await Task.insertMany([
      { name: 'a', status: 'succeeded', scheduledAt: t1 },
      { name: 'b', status: 'succeeded', scheduledAt: t2 },
      { name: 'c', status: 'failed', scheduledAt: t3 }
    ]);

    const res = await actions.Task.getTasksOverTime({ bucketSizeMs });
    assert.strictEqual(Array.isArray(res), true);
    assert.strictEqual(res.length, 2);

    // First bucket should have 2 succeeded
    const firstBucket = res[0];
    assert.strictEqual(firstBucket.succeeded, 2);
    assert.strictEqual(firstBucket.failed, 0);
    assert.strictEqual(firstBucket.cancelled, 0);

    // Second bucket should have 1 failed
    const secondBucket = res[1];
    assert.strictEqual(secondBucket.succeeded, 0);
    assert.strictEqual(secondBucket.failed, 1);
    assert.strictEqual(secondBucket.cancelled, 0);
  });

  it('counts succeeded, failed, and cancelled statuses', async function() {
    const base = new Date('2025-01-15T10:00:00Z');
    await Task.insertMany([
      { name: 'a', status: 'succeeded', scheduledAt: base },
      { name: 'b', status: 'succeeded', scheduledAt: base },
      { name: 'c', status: 'failed', scheduledAt: base },
      { name: 'd', status: 'cancelled', scheduledAt: base }
    ]);

    const res = await actions.Task.getTasksOverTime({ bucketSizeMs: 5 * 60 * 1000 });
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].succeeded, 2);
    assert.strictEqual(res[0].failed, 1);
    assert.strictEqual(res[0].cancelled, 1);
  });

  it('excludes pending tasks from results', async function() {
    const base = new Date('2025-01-15T10:00:00Z');
    await Task.insertMany([
      { name: 'a', status: 'pending', scheduledAt: base },
      { name: 'b', status: 'succeeded', scheduledAt: base }
    ]);

    const res = await actions.Task.getTasksOverTime({ bucketSizeMs: 5 * 60 * 1000 });
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].succeeded, 1);
    assert.strictEqual(res[0].failed, 0);
    assert.strictEqual(res[0].cancelled, 0);
  });

  it('filters by date range (start and end)', async function() {
    const start = new Date('2025-01-15T10:00:00Z');
    const end = new Date('2025-01-15T11:00:00Z');
    const inRange = new Date('2025-01-15T10:30:00Z');
    const outRange = new Date('2025-01-15T12:00:00Z');

    await Task.insertMany([
      { name: 'a', status: 'succeeded', scheduledAt: inRange },
      { name: 'b', status: 'failed', scheduledAt: outRange }
    ]);

    const res = await actions.Task.getTasksOverTime({ start, end, bucketSizeMs: 5 * 60 * 1000 });
    assert.strictEqual(Array.isArray(res), true);
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].succeeded, 1);
    assert.strictEqual(res[0].failed, 0);
  });

  it('filters by start date only', async function() {
    const start = new Date('2025-01-15T10:00:00Z');
    await Task.insertMany([
      { name: 'a', status: 'succeeded', scheduledAt: new Date('2025-01-15T11:00:00Z') },
      { name: 'b', status: 'failed', scheduledAt: new Date('2025-01-15T09:00:00Z') }
    ]);

    const res = await actions.Task.getTasksOverTime({ start, bucketSizeMs: 60 * 60 * 1000 });
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].succeeded, 1);
  });

  it('returns buckets sorted by timestamp ascending', async function() {
    const bucketSizeMs = 60 * 60 * 1000; // 1 hour
    await Task.insertMany([
      { name: 'a', status: 'succeeded', scheduledAt: new Date('2025-01-15T12:00:00Z') },
      { name: 'b', status: 'failed', scheduledAt: new Date('2025-01-15T10:00:00Z') },
      { name: 'c', status: 'cancelled', scheduledAt: new Date('2025-01-15T11:00:00Z') }
    ]);

    const res = await actions.Task.getTasksOverTime({ bucketSizeMs });
    assert.strictEqual(res.length, 3);
    const timestamps = res.map(r => new Date(r.timestamp).getTime());
    assert.ok(timestamps[0] < timestamps[1]);
    assert.ok(timestamps[1] < timestamps[2]);
  });

  it('each bucket has timestamp, succeeded, failed, cancelled fields', async function() {
    const base = new Date('2025-01-15T10:00:00Z');
    await Task.create({ name: 'a', status: 'succeeded', scheduledAt: base });

    const res = await actions.Task.getTasksOverTime({ bucketSizeMs: 5 * 60 * 1000 });
    assert.strictEqual(res.length, 1);
    assert.ok(res[0].timestamp instanceof Date || typeof res[0].timestamp === 'string' || res[0].timestamp != null);
    assert.ok('succeeded' in res[0]);
    assert.ok('failed' in res[0]);
    assert.ok('cancelled' in res[0]);
  });

  it('uses 5-minute bucket as default when bucketSizeMs is not provided', async function() {
    const t1 = new Date('2025-01-15T10:00:00Z');
    const t2 = new Date('2025-01-15T10:03:00Z'); // within same 5-min bucket
    await Task.insertMany([
      { name: 'a', status: 'succeeded', scheduledAt: t1 },
      { name: 'b', status: 'succeeded', scheduledAt: t2 }
    ]);

    const res = await actions.Task.getTasksOverTime({});
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].succeeded, 2);
  });
});
