'use strict';

const mpath = require('mpath');
const template = require('./document-property.html');

const appendCSS = require('../../appendCSS');

appendCSS(require('./document-property.css'));

module.exports = app => app.component('document-property', {
  template,
  data: function() {
    return {
      dateType: 'picker', // picker, iso
      isCollapsed: false, // Start uncollapsed by default
      isValueExpanded: false // Track if the value is expanded
    };
  },
  props: ['path', 'document', 'schemaPaths', 'editting', 'changes', 'invalid'],
  computed: {
    valueAsString() {
      const value = this.getValueForPath(this.path.path);
      if (value == null) {
        return String(value);
      }
      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
      }
      return String(value);
    },
    needsTruncation() {
      // Truncate if value is longer than 200 characters
      return this.valueAsString.length > 200;
    },
    displayValue() {
      if (!this.needsTruncation || this.isValueExpanded) {
        return this.getValueForPath(this.path.path);
      }
      // Return truncated value - we'll handle this in the template
      return this.getValueForPath(this.path.path);
    },
    truncatedString() {
      if (this.needsTruncation && !this.isValueExpanded) {
        return this.valueAsString.substring(0, 200) + '...';
      }
      return this.valueAsString;
    }
  },
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
      if (path.instance === 'Boolean') {
        return 'edit-boolean';
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
      const documentValue = mpath.get(path, this.document);
      return documentValue;
    },
    toggleCollapse() {
      this.isCollapsed = !this.isCollapsed;
    },
    toggleValueExpansion() {
      this.isValueExpanded = !this.isValueExpanded;
    }
  }
});