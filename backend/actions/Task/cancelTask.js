'use strict';

const Archetype = require('archetype');
const mongoose = require('mongoose');
const operationOptions = require('../../helpers/operationOptions');

const CancelTaskParams = new Archetype({
  taskId: {
    $type: mongoose.Types.ObjectId,
    $required: true
  },
  maxTimeMS: {
    $type: 'number'
  }
}).compile('CancelTaskParams');

module.exports = ({ db, options }) => async function cancelTask(params) {
  params = new CancelTaskParams(params);
  const { taskId } = params;
  const { Task } = db.models;

  const task = await Task.findOne({ _id: taskId }).
    setOptions(operationOptions(options, params)).
    orFail();

  const cancelledTask = await Task.cancelTask({ _id: taskId });
  return {
    task: cancelledTask
  };
};
