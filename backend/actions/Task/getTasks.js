'use strict';

const Archetype = require('archetype');

const GetTasksParams = new Archetype({
    start: {
        $type: Date
    },
    end: {
        $type: Date
    },
    status: {
        $type: 'string'
    }
}).compile('GetTasksParams');

module.exports = ({ db }) => async function getTasks(params) {
  params = new GetTasksParams(params);
  const { start, end, status } = params;
  const { Task } = db.models;

  const filter = {};

  if (start && end) {
    filter.scheduledAt = { $gte: start, $lte: end };
  } else if (start) {
    filter.scheduledAt = { $gte: start }
  }
  if (status) {
    filter.status = status;
  }

  const tasks = await Task.find(filter);
 
  return {
    tasks
  };
};