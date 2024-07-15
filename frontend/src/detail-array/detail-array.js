'use strict';

const template = require('./detail-array.html');
const util = require('util');

module.exports = app => app.component('detail-array', {
  template: template,
  props: ['value'],
  computed: {
    displayValue() {
      if (this.value == null) {
        return this.value;
      }
      return util.inspect(this.value);
    }
  },
  mounted() {
    Prism.highlightElement(this.$refs.code);
  }
});