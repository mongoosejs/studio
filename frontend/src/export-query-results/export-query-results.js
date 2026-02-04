'use strict';

const api = require('../api');
const template = require('./export-query-results.html');

const appendCSS = require('../appendCSS');

appendCSS(require('./export-query-results.css'));

module.exports = app => app.component('export-query-results', {
  template: template,
  props: ['schemaPaths', 'searchText', 'currentModel'],
  emits: ['done'],
  data: () => ({
    shouldExport: {}
  }),
  mounted() {
    this.shouldExport = {};
    for (const { path } of this.schemaPaths) {
      this.shouldExport[path] = true;
    }
  },
  methods: {
    async exportQueryResults() {
      const params = {
        model: this.currentModel,
        propertiesToInclude: Object.keys(this.shouldExport).filter(key => this.shouldExport[key])
      };
      if (typeof this.searchText === 'string' && this.searchText.trim().length > 0) {
        params.searchText = this.searchText;
      }
      await api.Model.exportQueryResults(params);
      this.$toast.success('Export completed!');
      this.$emit('done');
    }
  }
});