'use strict';

const template = require('./edit-boolean.html');

module.exports = app => app.component('edit-boolean', {
  template: template,
  props: ['value'],
  emits: ['input'],
  data() {
    return {
      selectedValue: null
    };
  },
  mounted() {
    this.selectedValue = this.value;
  },
  watch: {
    value(newValue) {
      this.selectedValue = newValue;
    },
    selectedValue(newValue) {
      // Convert null/undefined to strings for proper backend serialization
      const emitValue = this.convertValueToString(newValue);
      this.$emit('input', emitValue);
    }
  },
  methods: {
    selectValue(value) {
      this.selectedValue = value;
    },
    convertValueToString(value) {
      // Convert null/undefined to strings for proper backend serialization
      if (value === null) return 'null';
      if (typeof value === 'undefined') return 'undefined';
      return value;
    }
  }
});
