'use strict';

const template = require('./sleuth-investigating.html');

module.exports = app => app.component('sleuth-investigating', {
  template,
  inject: ['sleuthContext'],
  data: () => ({
    expandedLeftDocs: {}
  }),
  methods: {
    getLeftDocKey(doc) {
      if (!this.sleuthContext || !doc) {
        return '';
      }
      return this.sleuthContext.getDocumentKey(doc);
    },
    isLeftExpanded(doc) {
      const key = this.getLeftDocKey(doc);
      if (!key) {
        return false;
      }
      return !!this.expandedLeftDocs[key];
    },
    toggleLeftDetails(doc) {
      const key = this.getLeftDocKey(doc);
      if (!key) {
        return;
      }
      this.expandedLeftDocs[key] = !this.expandedLeftDocs[key];
    }
  }
});
