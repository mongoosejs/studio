'use strict';

const template = require('./detail-array.html');

module.exports = app => app.component('detail-array', {
  template: template,
  props: ['value'],
  computed: {
    displayValue() {
      return JSON.stringify(this.value, null, '  ').trim();
    }
  },
  mounted() {
    Prism.highlightElement(this.$refs.code);
  }
});