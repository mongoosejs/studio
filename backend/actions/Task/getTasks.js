'use strict';

const Archetype = require('archetype');

const GetTasksParams = new Archetype({
  start: { $type: Date },
  end: { $type: Date },
  status: { $type: 'string' },
  name: { $type: 'string' },
  skip: { $type: Number, $default: 0 },
  limit: { $type: Number, $default: 100 }
}).compile('GetTasksParams');

const ALL_STATUSES = ['pending', 'in_progress', 'succeeded', 'failed', 'cancelled', 'unknown'];

/** Max documents per request to avoid excessive memory and response size. */
const MAX_LIMIT = 2000;

/** Escape special regex characters so the name is matched literally. */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildMatch(params) {
  const { start, end, status, name } = params;
  const match = {};
  if (start != null && end != null) {
    match.scheduledAt = { $gte: start, $lt: end };
  } else if (start != null) {
    match.scheduledAt = { $gte: start };
  }
  const statusVal = typeof status === 'string' ? status.trim() : status;
  if (statusVal != null && statusVal !== '') {
    match.status = statusVal;
  } else {
    match.status = { $in: ALL_STATUSES };
  }
  if (name != null && name !== '') {
    const nameStr = typeof name === 'string' ? name.trim() : String(name);
    match.name = { $regex: escapeRegex(nameStr), $options: 'i' };
  }
  return match;
}

/** Projection done in aggregation: only fields needed by frontend, payload → parameters, _id → id. */
const TASK_PROJECT_STAGE = {
  _id: 1,
  id: '$_id',
  name: 1,
  status: 1,
  scheduledAt: 1,
  createdAt: 1,
  startedAt: 1,
  completedAt: 1,
  error: 1,
  parameters: '$payload'
};

function ensureDate(value) {
  if (value == null) return value;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return value;
}

module.exports = ({ db }) => async function getTasks(params) {
  params = new GetTasksParams(params);
  params.start = ensureDate(params.start);
  params.end = ensureDate(params.end);
  if (typeof params.status === 'string') params.status = params.status.trim();
  if (typeof params.name === 'string') params.name = params.name.trim();

  const skip = Math.max(0, Number(params.skip) || 0);
  const limit = Math.min(MAX_LIMIT, Math.max(0, Number(params.limit) || 100));
  const { Task } = db.models;
  const match = buildMatch(params);

  const pipeline = [
    { $match: match },
    {
      $facet: {
        tasks: [
          { $sort: { scheduledAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          { $project: TASK_PROJECT_STAGE }
        ],
        count: [{ $count: 'total' }]
      }
    }
  ];

  const [result] = await Task.aggregate(pipeline);
  const tasks = result.tasks || [];
  const numDocs = (result.count && result.count[0] && result.count[0].total) || 0;

  return { tasks, numDocs };
};
