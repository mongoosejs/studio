'use strict';

const api = require('../api');
const template = require('./dashboards.html');


module.exports = app => app.component('dashboards', {
  template: template,
  data: () => ({
    status: 'loading',
    dashboards: [],
    showCreateDashboardModal: true
  }),
  async mounted() {
    const { dashboards } = await api.Dashboard.getDashboards();
    this.dashboards = dashboards;
    this.status = 'loaded';
  },
});
