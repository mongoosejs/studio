'use strict';

const template = require('./detail-objectid.html');

module.exports = app => app.component('detail-objectid', {
  template,
  props: ['value', 'viewMode'],
  emits: ['updated'],
  watch: {
    displayValue: {
      immediate: true,
      handler(val) {
        this.$emit('updated', val);
      }
    }
  },
  computed: {
    format() {
      return this.viewMode || 'hex';
    },
    hexValue() {
      if (this.value == null) {
        return null;
      }
      if (typeof this.value === 'string') {
        return this.value;
      }
      if (typeof this.value === 'object') {
        if (typeof this.value.toHexString === 'function') {
          return this.value.toHexString();
        }
        if (typeof this.value.$oid === 'string') {
          return this.value.$oid;
        }
      }
      return String(this.value);
    },
    objectIdDate() {
      const hex = this.hexValue;
      if (!/^[0-9a-fA-F]{24}$/.test(hex || '')) {
        return null;
      }
      const seconds = parseInt(hex.slice(0, 8), 16);
      return new Date(seconds * 1000);
    },
    displayValue() {
      if (this.value == null) {
        return String(this.value);
      }

      const hex = this.hexValue;
      if (this.format === 'object_call') {
        return `Object("${hex}")`;
      }
      if (this.format === 'unix_seconds') {
        if (!this.objectIdDate) {
          return 'Invalid ObjectId';
        }
        return String(Math.floor(this.objectIdDate.getTime() / 1000));
      }
      if (this.format === 'date') {
        if (!this.objectIdDate) {
          return 'Invalid ObjectId';
        }
        return this.objectIdDate.toISOString();
      }
      return hex;
    }
  }
});
