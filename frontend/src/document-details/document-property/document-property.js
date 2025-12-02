/* global clearTimeout setTimeout */

'use strict';

const mpath = require('mpath');
const { inspect } = require('node-inspect-extracted');
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
    isArray() {
      const value = this.getValueForPath(this.path.path);
      return Array.isArray(value);
    },
    arrayValue() {
      if (this.isArray) {
        return this.getValueForPath(this.path.path);
      }
      return [];
    },
    needsTruncation() {
      // For arrays, check if it has more than 3 items (regardless of expansion state)
      if (this.isArray) {
        const arr = this.arrayValue;
        return arr && arr.length > 3;
      }
      // For other types, truncate if value is longer than 200 characters
      return this.valueAsString.length > 200;
    },
    shouldShowTruncated() {
      // For arrays, show truncated view if needs truncation and not expanded
      if (this.isArray) {
        return this.needsTruncation && !this.isValueExpanded;
      }
      // For other types, show truncated if needs truncation and not expanded
      return this.needsTruncation && !this.isValueExpanded;
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
        // Arrays are handled in template, so this is for non-arrays
        if (!this.isArray) {
          return this.valueAsString.substring(0, 200) + '...';
        }
      }
      return this.valueAsString;
    },
    truncatedArrayItems() {
      if (this.isArray && this.needsTruncation && !this.isValueExpanded) {
        return this.arrayValue.slice(0, 2);
      }
      return [];
    },
    remainingArrayCount() {
      if (this.isArray && this.needsTruncation && !this.isValueExpanded) {
        return this.arrayValue.length - 2;
      }
      return 0;
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
        if (path.enum?.length > 0) {
          props.enumValues = path.enum;
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
    formatArrayItem(item) {
      if (item == null) {
        return 'null';
      }
      if (typeof item === 'object') {
        return inspect(item, { maxArrayLength: 50 });
      }
      return String(item);
    },
    isObjectItem(item) {
      return item != null && typeof item === 'object' && !Array.isArray(item) && item.constructor === Object;
    },
    getItemKeys(item) {
      if (!this.isObjectItem(item)) {
        return [];
      }
      return Object.keys(item);
    },
    formatItemValue(item, key) {
      const value = item[key];
      if (value === null || value === undefined) {
        return 'null';
      }
      if (typeof value === 'object') {
        return inspect(value, { maxArrayLength: 50 });
      }
      return String(value);
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
