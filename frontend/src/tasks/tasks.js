'use strict';

const template = require('./tasks.html');

module.exports = app => app.component('tasks', {
  data: () => ({
    status: 'init'
  }),
  template: template
});