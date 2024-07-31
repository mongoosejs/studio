

'use strict';

const api = require('../api');
const template = require('./dashboard-result.html');

module.exports = app => app.component('dashboard-result', {
  template: template,
  props: ['result'],
  mounted: async function() {
  },
  methods: {
    getComponentForValue(value) {
      if (typeof value !== 'object' || value == null) {
        return 'dashboard-primitive';
      }
      if (value.$primitive) {
        return 'dashboard-primitive';
      }
      if (value.$chart) {
        return 'dashboard-chart';
      }
      if (value.$document) {
        return 'dashboard-document';
      }
    }
  }
});
