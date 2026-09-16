'use strict';

const Archetype = require('archetype');
const mongoose = require('mongoose');
const omitNullish = require('../../helpers/omitNullish');

const RescheduleTaskParams = new Archetype({
  taskId: {
    $type: mongoose.Types.ObjectId,
    $required: true
  },
  scheduledAt: {
    $type: Date,
    $required: true
  }
}).compile('RescheduleTaskParams');

module.exports = ({ db, options }) => async function rescheduleTask(params) {
  params = new RescheduleTaskParams(params);
  const { taskId, scheduledAt } = params;
  const { Task } = db.models;

  const task = await Task.findOne({ _id: taskId }).
    setOptions(omitNullish({ maxTimeMS: options?.maxTimeMS })).
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
