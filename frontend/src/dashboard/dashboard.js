'use strict';

const api = require('../api');
const template = require('./dashboard.html');


module.exports = app => app.component('dashboard', {
  template: template,
  data: () => ({
    dashboards: [],
    dashboard: null
  }),
  async mounted() {
    const { dashboards } = await api.Dashboard.getDashboards();
    this.dashboards = dashboards;
    if (!this.$route.query.dashboardId) {
      return;
    }
    this.dashboard = dashboards.find(x => x._id.toString() == this.$route.query.dashboardId);
    this.status = 'loaded';
  },
});
