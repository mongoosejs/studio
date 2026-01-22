'use strict';

const template = require('./sleuth-aggregating.html');

module.exports = app => app.component('sleuth-aggregating', {
  template,
  inject: ['sleuthContext']
});
