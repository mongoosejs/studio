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
      this.$emit('input', newValue);
    }
  },
  methods: {
    selectValue(value) {
      this.selectedValue = value;
    }
  }
});
