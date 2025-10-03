

'use strict';

const api = require('../api');
const template = require('./dashboard-result.html');

module.exports = app => app.component('dashboard-result', {
  template: template,
  props: ['result', 'finishedEvaluatingAt', 'fullscreen'],
  emits: ['fullscreen'],
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
      if (value.$featureCollection) {
        return 'dashboard-map';
      }
      if (value.$text) {
        return 'dashboard-text';
      }
      if (value.$grid) {
        return 'dashboard-grid';
      }
    }
  }
});
