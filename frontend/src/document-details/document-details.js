'use strict';

const mpath = require('mpath');
const template = require('./document-details.html')

const appendCSS = require('../appendCSS');

appendCSS(require('./document-details.css'));

module.exports = app => app.component('document-details', {
  template,
  props: ['document', 'schemaPaths', 'editting', 'changes'],
  methods: {
    getComponentForPath(schemaPath) {
      if (schemaPath.instance === 'Array') {
        return 'detail-array';
      }
      return 'detail-default';
    },
    getEditComponentForPath(path) {
      if (path.instance == 'Date') {
        return 'edit-date';
      }
      if (path.instance == 'Number') {
        return 'edit-number';
      }
      if (path.instance === 'Array') {
        return 'edit-array';
      }
      return 'edit-default';
    },
    getValueForPath(path) {
      return mpath.get(path, this.document);
    },
    getEditValueForPath({ path }) {
      if (!this.changes) {
        return;
      }
      return path in this.changes ? this.changes[path] : mpath.get(path, this.document);
    }
  },
  computed: {
    virtuals() {
      if (this.schemaPaths == null) {
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
    }
  }
})