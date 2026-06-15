'use strict';

const api = require('../api');
const appendCSS = require('../appendCSS');
const template = require('./case-reports.html');

appendCSS(require('./case-reports.css'));

module.exports = app => app.component('case-reports', {
  template: template,
  data: () => ({
    status: 'loading',
    caseReports: []
  }),
  computed: {
    totalDocuments() {
      return this.caseReports.reduce((sum, report) => sum + this.getDocumentCount(report), 0);
    },
    reportsWithSummary() {
      return this.caseReports.filter(report => this.hasSummary(report)).length;
    }
  },
  methods: {
    formatDate(date) {
      if (!date) return 'N/A';
      try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'N/A';
        return d.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        });
      } catch (e) {
        return 'N/A';
      }
    },
    formatRelativeDate(date) {
      if (!date) return '';
      try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        const diffMs = Date.now() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `${diffDays}d ago`;
        return this.formatDate(date);
      } catch (e) {
        return '';
      }
    },
    getDocumentCount(caseReport) {
      return Array.isArray(caseReport && caseReport.documents) ? caseReport.documents.length : 0;
    },
    getNotesCount(caseReport) {
      if (!Array.isArray(caseReport && caseReport.documents)) {
        return 0;
      }
      return caseReport.documents.filter(entry =>
        entry && typeof entry.notes === 'string' && entry.notes.trim().length > 0
      ).length;
    },
    hasSummary(caseReport) {
      return typeof caseReport.summary === 'string' && caseReport.summary.trim().length > 0;
    },
    hasAiSummary(caseReport) {
      return typeof caseReport.AISummary === 'string' && caseReport.AISummary.trim().length > 0;
    },
    getReportPreview(caseReport) {
      if (this.hasSummary(caseReport)) {
        const text = caseReport.summary.trim();
        return text.length > 160 ? `${text.slice(0, 157)}…` : text;
      }
      if (this.hasAiSummary(caseReport)) {
        return 'AI-enhanced summary available';
      }
      return '';
    }
  },
  async mounted() {
    try {
      const { caseReports } = await api.CaseReport.getCaseReports();
      this.caseReports = caseReports;
      this.status = 'loaded';
    } catch (error) {
      console.error('Error loading case reports', error);
      this.status = 'loaded';
    }
  }
});
