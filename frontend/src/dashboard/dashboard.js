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
      result: null,
      errorMessage: null
    }
  },
  methods: {
    toggleEditor() {
      this.showEditor = !this.showEditor;
    },
    async updateCode(update) {
      this.code = update.doc.code;
      this.title = update.doc.title;
      this.description = update.doc.description;
      if (update.result) {
        this.result = update.result;
      } else {
        this.errorMessage = update.error.message;
      }
    }
  },
  mounted: async function() {
    const { dashboard, result, error } = await api.Dashboard.getDashboard({ dashboardId: this.dashboardId, evaluate: true });
    if (!dashboard) {
      return;
    }
    this.dashboard = dashboard;
    if (error) {
      this.errorMessage = error.message;
    }
    this.code = this.dashboard.code;
    this.title = this.dashboard.title;
    this.description = this.dashboard.description ?? '';
    this.result = result;
    this.status = 'loaded';
  }
});
