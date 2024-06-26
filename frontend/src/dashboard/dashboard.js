'use strict';

const api = require('../api');
const template = require('./dashboard.html');

module.exports = app => app.component('dashboard', {
  template: template,
  data: function() {
    return {
      status: 'loading',
      code: '',
      name: '',
      showEditor: false,
      dashboard: null
    }
  },
  methods: {
    toggleEditor() {
      this.showEditor = !this.showEditor;
    },
    async updateCode(update) {
      this.code = update;
    }
  },
  mounted: async function() {
    const dashboardId = this.$route.query.dashboardId;
    const { dashboard } = await api.Dashboard.getDashboard({ params: { dashboardId: dashboardId } });
    if (!dashboard) {
      return;
    }
    this.dashboard = dashboard;
    this.name = this.dashboard.name;
    this.code = this.dashboard.code;
    this.status = 'loaded';
  }
});
