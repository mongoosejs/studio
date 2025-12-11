'use strict';

const template = require('./detail-array.html');
const { inspect } = require('node-inspect-extracted');

module.exports = app => app.component('detail-array', {
  template: template,
  props: ['value'],
  data() {
    return {
      arrayValue: []
    };
  },
  methods: {
    formatValue(item) {
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
    initializeArray() {
      if (this.value == null) {
        this.arrayValue = [];
      } else if (Array.isArray(this.value)) {
        this.arrayValue = this.value;
      } else {
        this.arrayValue = [];
      }
    }
  },
  mounted() {
    this.initializeArray();
  },
  watch: {
    value: {
      handler(newValue) {
        this.initializeArray();
      },
      deep: true,
      immediate: true
    }
  }
});