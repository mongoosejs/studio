'use strict';

const template = require('./list-array.html');

module.exports = app => app.component('list-array', {
  template: template,
  props: ['value']
});