'use strict';

const Archetype = require('archetype');

const CreateTaskParams = new Archetype({
    name: {
        $type: 'string',
        $required: true
    },
    scheduledAt: {
        $type: Date,
        $required: true
    },
    repeatAfterMS: {
        $type: 'number'
    },
    payload: {
        $type: Archetype.Any
    }
}).compile('CreateTaskParams');

module.exports = ({ db }) => async function createTask(params) {
  params = new CreateTaskParams(params);
 
  const { name, scheduledAt, payload, repeatAfterMS } = params;
  const { Task } = db.models;

  const task = await Task.schedule(name, scheduledAt, payload, repeatAfterMS);
 
  return {
    task
  };
};