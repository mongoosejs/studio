/* global clearTimeout setTimeout */

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
      isValueExpanded: false, // Track if the value is expanded
      copyButtonLabel: 'Copy',
      copyResetTimeoutId: null
    };
  },
  beforeDestroy() {
    if (this.copyResetTimeoutId) {
      clearTimeout(this.copyResetTimeoutId);
      this.copyResetTimeoutId = null;
    }
  },
  props: ['path', 'document', 'schemaPaths', 'editting', 'changes', 'invalid', 'highlight'],
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
      if (path.instance === 'String') {
        return 'edit-string';
      }
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
    getEditComponentProps(path) {
      const props = {};
      if (path.instance === 'String') {
        const enumValues = this.getEnumValues(path);
        if (enumValues.length > 0) {
          props.enumValues = enumValues;
        }
      }
      return props;
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
    },
    getEnumValues(path) {
      if (!path) {
        return [];
      }
      if (Array.isArray(path.enumValues) && path.enumValues.length > 0) {
        return path.enumValues;
      }
      if (path.options && Array.isArray(path.options.enum) && path.options.enum.length > 0) {
        return path.options.enum;
      }
      return [];
    },
    setCopyFeedback() {
      this.copyButtonLabel = 'Copied';
      if (this.copyResetTimeoutId) {
        clearTimeout(this.copyResetTimeoutId);
      }
      this.copyResetTimeoutId = setTimeout(() => {
        this.copyButtonLabel = 'Copy';
        this.copyResetTimeoutId = null;
      }, 5000);
    },
    copyPropertyValue() {
      const textToCopy = this.valueAsString;
      if (textToCopy == null) {
        return;
      }

      const fallbackCopy = () => {
        if (typeof document === 'undefined') {
          return;
        }
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.setAttribute('readonly', '');
        textArea.style.position = 'absolute';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
        } finally {
          document.body.removeChild(textArea);
        }
        this.setCopyFeedback();
      };

      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy)
          .then(() => {
            this.setCopyFeedback();
          })
          .catch(() => {
            fallbackCopy();
          });
      } else {
        fallbackCopy();
      }
    }
  }
});
