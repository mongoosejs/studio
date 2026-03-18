'use strict';

const Archetype = require('archetype');

const GetTasksOverTimeParams = new Archetype({
  start: { $type: Date },
  end: { $type: Date },
  bucketSizeMs: { $type: 'number' }
}).compile('GetTasksOverTimeParams');

const TRACKED_STATUSES = ['succeeded', 'failed', 'cancelled'];

module.exports = ({ db }) => async function getTasksOverTime(params) {
  params = new GetTasksOverTimeParams(params);
  const { Task } = db.models;
  const { start, end, bucketSizeMs } = params;

  const bucketMs = (bucketSizeMs != null && bucketSizeMs > 0) ? bucketSizeMs : 5 * 60 * 1000;

  const match = { status: { $in: TRACKED_STATUSES } };
  if (start != null && end != null) {
    match.scheduledAt = { $gte: start, $lt: end };
  } else if (start != null) {
    match.scheduledAt = { $gte: start };
  }

  const pipeline = [
    { $match: match },
    {
      $project: {
        status: 1,
        bucket: {
          $toDate: {
            $multiply: [
              { $floor: { $divide: [{ $toLong: '$scheduledAt' }, bucketMs] } },
              bucketMs
            ]
          }
        }
      }
    },
    {
      $group: {
        _id: { bucket: '$bucket', status: '$status' },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.bucket',
        counts: { $push: { status: '$_id.status', count: '$count' } }
      }
    },
    { $sort: { _id: 1 } }
  ];

  const results = await Task.aggregate(pipeline);

  return results.map(r => {
    const bucket = { timestamp: r._id, succeeded: 0, failed: 0, cancelled: 0 };
    for (const { status, count } of r.counts) {
      if (status in bucket) bucket[status] = count;
    }
    return bucket;
  });
};
