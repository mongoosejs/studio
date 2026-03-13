'use strict';

const template = require('./dashboard-table.html');

module.exports = app => app.component('dashboard-table', {
  template,
  props: ['value'],
  computed: {
    columns() {
      return Array.isArray(this.value?.$table?.columns) ? this.value.$table.columns : [];
    },
    rows() {
      return Array.isArray(this.value?.$table?.rows) ? this.value.$table.rows : [];
    },
    hasColumns() {
      return this.columns.length > 0;
    },
    hasRows() {
      return this.rows.length > 0;
    }
  },
  methods: {
    displayValue(cell) {
      if (cell == null) {
        return '';
      }
      if (typeof cell === 'object') {
        try {
          return JSON.stringify(cell);
        } catch (err) {
          return String(cell);
        }
      }
      return String(cell);
    }
  }
});
