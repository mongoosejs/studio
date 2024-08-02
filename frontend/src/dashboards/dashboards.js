'use strict';

const api = require('../api');
const template = require('./dashboards.html');


module.exports = app => app.component('dashboards', {
  template: template,
  data: () => ({
    status: 'loading',
    dashboards: [],
    showCreateDashboardModal: false,
    showDeleteDashboardModal: null
  }),
  methods: {
    async deleteDashboard(dashboard) {
      if (!dashboard) {
        return;
      }
      const { result } = await api.Dashboard.deleteDashboard({ dashboardId: dashboard._id });
      if (result.deletedCount > 0) {
        const removedDashboard = this.dashboards.findIndex(x => x._id.toString() === dashboard._id.toString());
        this.dashboards.splice(removedDashboard, 1);
        this.showDeleteDashboardModal = null;
      } else {
        throw new Error('Dashboard unable to be deleted');
      }
    },
    insertNewDashboard(dashboard) {
      this.dashboards.push(dashboard);
      this.showCreateDashboardModal = false;
    }
  },
  async mounted() {
    const { dashboards } = await api.Dashboard.getDashboards();
    this.dashboards = dashboards;
    this.status = 'loaded';
  },
});
