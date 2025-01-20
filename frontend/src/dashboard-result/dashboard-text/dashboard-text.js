'use strict';

const template = require('./dashboard-text.html');

module.exports = app => app.component('dashboard-text', {
  template: template,
  props: ['value']
});
