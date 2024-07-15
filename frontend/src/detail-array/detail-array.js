'use strict';

const template = require('./detail-array.html');
const { inspect } = require('node-inspect-extracted');

module.exports = app => app.component('detail-array', {
  template: template,
  props: ['value'],
  computed: {
    displayValue() {
      if (this.value == null) {
        return this.value;
      }
      return inspect(this.value, { maxArrayLength: 50 });
    }
  },
  mounted() {
    Prism.highlightElement(this.$refs.code);
  }
});