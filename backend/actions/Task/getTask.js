'use strict';

const Archetype = require('archetype');
const mongoose = require('mongoose');

const GetTaskParams = new Archetype({
  taskId: {
    $type: mongoose.Types.ObjectId,
    $required: true
  }
}).compile('GetTaskParams');

module.exports = ({ db }) => async function getTask(params) {
  params = new GetTaskParams(params);
  const { taskId } = params;
  const { Task } = db.models;

  const task = await Task.findOne({ _id: taskId }).orFail();

  return {
    task
  };
};
