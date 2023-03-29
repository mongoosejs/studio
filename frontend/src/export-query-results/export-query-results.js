'use strict';

const api = require('../api');
const template = require('./export-query-results.html');

const appendCSS = require('../appendCSS');

appendCSS(require('./export-query-results.css'));

module.exports = app => app.component('export-query-results', {
  template: template,
  props: ['schemaPaths', 'filter', 'currentModel'],
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
      await api.Model.exportQueryResults({
        model: this.currentModel,
        filter: this.filter,
        propertiesToInclude: Object.keys(this.shouldExport).filter(key => this.shouldExport[key])
      });

      this.$emit('done');
    }
  }
});