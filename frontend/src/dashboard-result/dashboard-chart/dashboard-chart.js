'use strict';

const template = require('./dashboard-chart.html');

module.exports = app => app.component('dashboard-chart', {
  template: template,
  props: ['value'],
  mounted() {
    const ctx = this.$refs.chart.getContext('2d');
    const chart = new Chart(ctx, this.value.$chart);
  },
  computed: {
    header() {
      if (this.value != null && this.value.$chart.header) {
        return this.value.$chart.header;
      }
      return null;
    }
  }
});
