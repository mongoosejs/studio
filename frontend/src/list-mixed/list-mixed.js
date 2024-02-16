'use strict';

const api = require('../api');
const template = require('./list-mixed.html');

// require('../appendCSS')(require('./list-mixed.css'));

module.exports = app => app.component('list-mixed', {
  template: template,
  props: ['value'],
  computed: {
    shortenValue() {
      return this.value;
    }
  },
  mounted: function() {
    Prism.highlightElement(this.$refs.MixedCode);
  }
});
