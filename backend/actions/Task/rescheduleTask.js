'use strict';

const Archetype = require('archetype');
const mongoose = require('mongoose');
const operationOptions = require('../../helpers/operationOptions');

const RescheduleTaskParams = new Archetype({
  taskId: {
    $type: mongoose.Types.ObjectId,
    $required: true
  },
  scheduledAt: {
    $type: Date,
    $required: true
  },
  maxTimeMS: {
    $type: 'number'
  }
}).compile('RescheduleTaskParams');

module.exports = ({ db, options }) => async function rescheduleTask(params) {
  params = new RescheduleTaskParams(params);
  const { taskId, scheduledAt } = params;
  const { Task } = db.models;

  const task = await Task.findOne({ _id: taskId }).
    setOptions(operationOptions(options, params)).
    orFail();

  if (scheduledAt < Date.now()) {
    throw new Error('Cannot reschedule a task for the past');
  }

  if (task.status != 'pending') {
    throw new Error('Cannot reschedule a task that is not pending');
  }

  task.scheduledAt = scheduledAt;

  await task.save();
 
  return {
    task
  };
};
