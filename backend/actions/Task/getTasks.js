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
  
  // Define all possible statuses
  const allStatuses = ['pending', 'in_progress', 'succeeded', 'failed', 'cancelled', 'unknown'];
  
  // Initialize groupedTasks with all statuses
  const groupedTasks = allStatuses.reduce((groups, status) => {
    groups[status] = [];
    return groups;
  }, {});
  
  // Group tasks by status
  tasks.forEach(task => {
    const taskStatus = task.status || 'unknown';
    if (groupedTasks.hasOwnProperty(taskStatus)) {
      groupedTasks[taskStatus].push(task);
    }
  });
 
  return {
    tasks,
    groupedTasks
  };
};