'use strict';

const api = require('../api');
const template = require('./dashboard.html');

module.exports = app => app.component('dashboard', {
  template: template,
  props: ['dashboardId'],
  data: function() {
    return {
      status: 'loading',
      code: '',
      showEditor: false,
      dashboard: null,
      result: null
    }
  },
  methods: {
    toggleEditor() {
      this.showEditor = !this.showEditor;
    },
    async updateCode(update) {
      this.code = update.doc.code;
      this.result = update.result;
    }
  },
  mounted: async function() {
    const { dashboard, result } = await api.Dashboard.getDashboard({ dashboardId: this.dashboardId, evaluate: true });
    if (!dashboard) {
      return;
    }
    this.dashboard = dashboard;
    this.code = this.dashboard.code;
    this.result = result;
    this.status = 'loaded';
  }
});
