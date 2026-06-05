'use strict';

const marked = require('marked').marked;
const appendCSS = require('../../appendCSS');
const template = require('./sleuth-unified.html');

appendCSS(require('./sleuth-unified.css'));

module.exports = app => app.component('sleuth-unified', {
  template,
  inject: ['sleuthContext'],
  data() {
    return {
      caseReportSections: {
        documents: true,
        notes: true
      }
    };
  },
  methods: {
    renderMarkdown(text) {
      if (!text) return '';
      return marked(text);
    },
    hasAiSummary() {
      const s = this.sleuthContext && this.sleuthContext.aiSummary;
      return typeof s === 'string' && s.trim().length > 0;
    },
    toggleCaseReportSection(section) {
      if (typeof section === 'string' && Object.prototype.hasOwnProperty.call(this.caseReportSections, section)) {
        this.caseReportSections[section] = !this.caseReportSections[section];
      }
    },
    isCaseReportSectionOpen(section) {
      return !!this.caseReportSections[section];
    }
  }
});
