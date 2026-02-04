'use strict';

const Archetype = require('archetype');
const mongoose = require('mongoose');

const RunTaskParams = new Archetype({
  taskId: {
    $type: mongoose.Types.ObjectId,
    $required: true
  }
}).compile('RunTaskParams');

module.exports = ({ db }) => async function runTask(params) {
  params = new RunTaskParams(params);
  const { taskId } = params;
  const { Task } = db.models;

  const task = await Task.findOne({ _id: taskId }).orFail();

  const executedTask = await Task.execute(task);
 
  return {
    task: executedTask
  };
};