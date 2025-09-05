'use strict';

const template = require('./dashboard-grid.html');

module.exports = app => app.component('dashboard-grid', {
  template: template,
  props: ['value'],
  computed: {
    columns() {
      const grid = this.value && this.value.$grid;
      if (!Array.isArray(grid) || grid.length === 0) {
        return 1;
      }
      return Math.max(1, ...grid.map(row => Array.isArray(row) ? row.length : 0));
    },
    gridTemplateColumns() {
      return `repeat(${this.columns}, minmax(0, 1fr))`;
    }
  }
});
