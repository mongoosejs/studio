/* global clearTimeout setTimeout */

'use strict';

const mpath = require('mpath');
const deepEqual = require('../../_util/deepEqual');
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
    _arrayValueData() {
      const value = this.getValueForPath(this.path.path);
      return {
        value: Array.isArray(value) ? value : [],
        isArray: Array.isArray(value)
      };
    },
    isArray() {
      return this._arrayValueData.isArray;
    },
    arrayValue() {
      return this._arrayValueData.value;
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
    handleInputChange(newValue) {
      const currentValue = this.getValueForPath(this.path.path);
      console.log('ABB', currentValue, newValue, this.path.path);

      // Only record as a change if the value is actually different
      if (!deepEqual(currentValue, newValue)) {
        this.changes[this.path.path] = newValue;
        console.log('SET  TO', newValue);
      } else {
        // If the value is the same as the original, remove it from changes
        delete this.changes[this.path.path];
      }

      // Always clear invalid state on input
      delete this.invalid[this.path.path];
    },
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
      if (path.instance === 'Mixed') {
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
      if (path.instance === 'Array') {
        props.path = path;
        props.schemaPaths = this.schemaPaths;
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
