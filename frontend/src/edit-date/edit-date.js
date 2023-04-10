'use strict';

const template = require('./edit-date.html');

module.exports = app => app.component('edit-date', {
  template: template,
  props: ['value'],
  emits: ['input']
});
