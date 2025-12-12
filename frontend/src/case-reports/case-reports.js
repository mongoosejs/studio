'use strict';

const api = require('../api');
const template = require('./case-reports.html');

module.exports = app => app.component('case-reports', {
  template: template,
  data: () => ({
    status: 'loading',
    caseReports: []
  }),
  methods: {
    formatDate(date) {
      if (!date) return 'N/A';
      try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'N/A';
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
      } catch (e) {
        return 'N/A';
      }
    }
  },
  async mounted() {
    try {
      const { caseReports } = await api.Sleuth.getCaseReports();
      this.caseReports = caseReports;
      this.status = 'loaded';
    } catch (error) {
      console.error('Error loading case reports', error);
      this.status = 'loaded';
    }
  }
});
