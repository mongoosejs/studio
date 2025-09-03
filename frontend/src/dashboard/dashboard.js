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
      title: '',
      description: '',
      showEditor: false,
      dashboard: null,
      dashboardResults: [],
      errorMessage: null,
      showDetailModal: false
    };
  },
  methods: {
    toggleEditor() {
      this.showEditor = !this.showEditor;
    },
    async updateCode(update) {
      this.code = update.doc.code;
      this.title = update.doc.title;
      this.description = update.doc.description;

      await this.evaluateDashboard();
    },
    async evaluateDashboard() {
      this.status = 'evaluating';
      try {
        const { dashboard, dashboardResult } = await api.Dashboard.getDashboard({ dashboardId: this.dashboardId, evaluate: true });
        this.dashboard = dashboard;
        this.code = this.dashboard.code;
        this.title = this.dashboard.title;
        this.description = this.dashboard.description ?? '';
        if (dashboardResult) {
          this.dashboardResults.unshift(dashboardResult);
        }
      } finally {
        this.status = 'loaded';
      }
    }
  },
  computed: {
    dashboardResult() {
      return this.dashboardResults.length > 0 ? this.dashboardResults[0] : null;
    }
  },
  mounted: async function() {
    this.showEditor = this.$route.query.edit;
    const { dashboard, dashboardResults, error } = await api.Dashboard.getDashboard({ dashboardId: this.dashboardId, evaluate: false });
    if (!dashboard) {
      return;
    }
    this.dashboard = dashboard;
    this.code = this.dashboard.code;
    this.title = this.dashboard.title;
    this.description = this.dashboard.description ?? '';
    this.dashboardResults = dashboardResults;
    this.status = 'loaded';
  }
});
