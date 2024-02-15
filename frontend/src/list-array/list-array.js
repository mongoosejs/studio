'use strict';

const template = require('./list-array.html');

require('../appendCSS')(require('./list-array.css'));

module.exports = app => app.component('list-array', {
  template: template,
  props: ['value'],
  computed: {
    displayValue() {
      return this.value;
    }
  },
  mounted() {
    Prism.highlightElement(this.$refs.code);
  }
});
