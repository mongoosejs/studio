'use strict';

const api = require('../api');
const template = require('./dashboard.html');


module.exports = app => app.component('dashboard', {
  template: template,
  data: () => ({
    dashboards: []
  }),
  async mounted() {
    const { dashboards } = await api.Dashboard.getDashboards();
    this.dashboards = dashboards;
    this.status = 'loaded';
  },
});
