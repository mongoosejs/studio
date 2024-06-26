'use strict';

const api = require('../api');
const template = require('./dashboards.html');


module.exports = app => app.component('dashboards', {
  template: template,
  data: () => ({
    dashboards: [],
  }),
  async mounted() {
    const { dashboards } = await api.Dashboard.getDashboards();
    this.dashboards = dashboards;
    if (!this.$route.query.dashboardId) {
      return;
    }
    this.status = 'loaded';
  },
});
