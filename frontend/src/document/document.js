'use strict';

const api = require('../api');
const template = require('./document.html');

const appendCSS = require('../appendCSS');

appendCSS(require('./document.css'));

module.exports = app => app.component('document', {
  template: template,
  props: ['model', 'documentId'],
  data: () => ({
    schemaPaths: [],
    status: 'init',
    document: null
  }),
  async mounted() {
    const { doc, schemaPaths } = await api.Model.getDocument({ model: this.model, documentId: this.documentId });
    this.document = doc;
    this.schemaPaths = Object.keys(schemaPaths).sort((k1, k2) => {
      if (k1 === '_id' && k2 !== '_id') {
        return -1;
      }
      if (k1 !== '_id' && k2 === '_id') {
        return 1;
      }
      return 0;
    }).map(key => schemaPaths[key]);

    this.status = 'loaded';
  },
  methods: {
    getComponentForPath(schemaPath) {
      if (schemaPath.instance === 'Array') {
        return 'detail-array';
      }
      return 'detail-default';
    }
  }
});