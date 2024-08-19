'use strict';

const mpath = require('mpath');
const template = require('./document-details.html')

const appendCSS = require('../appendCSS');

appendCSS(require('./document-details.css'));

module.exports = app => app.component('document-details', {
  template,
  props: ['document', 'schemaPaths', 'editting', 'changes', 'invalid'],
  computed: {
    virtuals() {
      if (this.schemaPaths == null) {
        return [];
      }
      if (this.document == null) {
        return [];
      }
      const exists = this.schemaPaths.map(x => x.path);
      const docKeys = Object.keys(this.document);
      const result = [];
      for (let i = 0; i < docKeys.length; i++) {
        if (!exists.includes(docKeys[i])) {
          result.push({ name: docKeys[i], value: this.document[docKeys[i]] });
        }
      }

      return result;
    },
  }
})