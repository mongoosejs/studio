'use strict';

const Archetype = require('archetype');

const GetTaskOverviewParams = new Archetype({
  start: { $type: Date },
  end: { $type: Date },
  status: { $type: 'string' },
  name: { $type: 'string' }
}).compile('GetTaskOverviewParams');

/** Statuses shown on the Task overview page. */
const OVERVIEW_STATUSES = ['pending', 'succeeded', 'failed', 'cancelled'];

function ensureDate(value) {
  if (value == null) return value;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return value;
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildMatch(params) {
  const { start, end, status, name } = params;
  const match = {};
  const startDate = ensureDate(start);
  const endDate = ensureDate(end);
  if (startDate != null && endDate != null) {
    match.scheduledAt = { $gte: startDate, $lt: endDate };
  } else if (startDate != null) {
    match.scheduledAt = { $gte: startDate };
  }
  const statusVal = typeof status === 'string' ? status.trim() : status;
  if (statusVal != null && statusVal !== '') {
    match.status = statusVal;
  } else {
    match.status = { $in: ['pending', 'in_progress', 'succeeded', 'failed', 'cancelled', 'unknown'] };
  }
  if (name != null && name !== '') {
    const nameStr = typeof name === 'string' ? name.trim() : String(name);
    match.name = { $regex: escapeRegex(nameStr), $options: 'i' };
  }
  return match;
}

module.exports = ({ db }) => async function getTaskOverview(params) {
  params = new GetTaskOverviewParams(params);
  params.start = ensureDate(params.start);
  params.end = ensureDate(params.end);
  if (typeof params.status === 'string') params.status = params.status.trim();
  if (typeof params.name === 'string') params.name = params.name.trim();
  const { Task } = db.models;
  const match = buildMatch(params);

  const defaultCounts = OVERVIEW_STATUSES.map(s => ({ k: s, v: 0 }));

  const pipeline = [
    { $match: match },
    {
      $facet: {
        statusCounts: [
          { $group: { _id: { $ifNull: ['$status', 'unknown'] }, count: { $sum: 1 } } },
          { $group: { _id: null, counts: { $push: { k: '$_id', v: '$count' } } } },
          {
            $project: {
              statusCounts: {
                $arrayToObject: {
                  $concatArrays: [{ $literal: defaultCounts }, '$counts']
                }
              }
            }
          },
          { $replaceRoot: { newRoot: '$statusCounts' } }
        ],
        tasksByName: [
          {
            $group: {
              _id: '$name',
              totalCount: { $sum: 1 },
              lastRun: { $max: '$scheduledAt' },
              pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
              succeeded: { $sum: { $cond: [{ $eq: ['$status', 'succeeded'] }, 1, 0] } },
              failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
              cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }
            }
          },
          {
            $project: {
              _id: 0,
              name: '$_id',
              totalCount: 1,
              lastRun: 1,
              statusCounts: {
                pending: '$pending',
                succeeded: '$succeeded',
                failed: '$failed',
                cancelled: '$cancelled'
              }
            }
          },
          { $sort: { name: 1 } }
        ]
      }
    }
  ];

  const [result] = await Task.aggregate(pipeline);

  return {
    statusCounts: result.statusCounts?.[0] ?? {},
    tasksByName: result.tasksByName || []
  };
};
