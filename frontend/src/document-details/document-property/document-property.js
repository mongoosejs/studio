'use strict';

const mpath = require('mpath');
const template = require('./document-property.html');

const appendCSS = require('../../appendCSS');

appendCSS(require('./document-property.css'));

module.exports = app => app.component('document-property', {
  template,
  data: function() {
    return {
      dateType: 'picker' // picker, iso
    };
  },
  props: ['path', 'document', 'schemaPaths', 'editting', 'changes', 'invalid'],
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
      if (path.instance === 'Embedded') {
        return 'edit-subdocument';
      }
      return 'edit-default';
    },
    getValueForPath(path) {
      if (this.document == null) {
        return undefined;
      }
      return mpath.get(path, this.document);
    },
    getEditValueForPath({ path }) {
      if (!this.changes) {
        return;
      }
      if (!this.document) {
        return;
      }
      return path in this.changes ? this.changes[path] : mpath.get(path, this.document);
    }
  }
});