'use strict';

const Archetype = require('archetype');
const mongoose = require('mongoose');
const omitNullish = require('../../helpers/omitNullish');

const CancelTaskParams = new Archetype({
  taskId: {
    $type: mongoose.Types.ObjectId,
    $required: true
  }
}).compile('CancelTaskParams');

module.exports = ({ db, options }) => async function cancelTask(params) {
  params = new CancelTaskParams(params);
  const { taskId } = params;
  const { Task } = db.models;

  const task = await Task.findOne({ _id: taskId }).
    setOptions(omitNullish({ maxTimeMS: options?.maxTimeMS })).
    orFail();

  const cancelledTask = await Task.cancelTask({ _id: taskId });
  return {
    task: cancelledTask
  };
};
