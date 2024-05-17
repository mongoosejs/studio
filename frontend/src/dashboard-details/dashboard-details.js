'use strict';

const api = require('../api');
const template = require('./dashboard-details.html');


module.exports = app => app.component('dashboard-details', {
  template: template,
  props: ['dashboard']
});
