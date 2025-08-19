'use strict';

const template = require('./dashboard-chart.html');

module.exports = app => app.component('dashboard-chart', {
  template: template,
  props: ['value', 'fullscreen'],
  emits: ['fullscreen'],
  data: () => ({
    chart: null,
    showDetailModal: false
  }),
  mounted() {
    const ctx = this.$refs.chart.getContext('2d');
    this.chart = new Chart(ctx, this.value.$chart);
  },
  methods: {
    exportPNG() {
      if (this.chart == null) {
        return;
      }
      const dataUrl = this.chart.toBase64Image();
      const anchor = document.createElement('a');
      anchor.href = dataUrl;
      anchor.download = 'chart.png';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }
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
