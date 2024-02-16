'use strict';

const api = require('../api');
const template = require('./list-subdocument.html');

// require('../appendCSS')(require('./list-subdocument.css'));

module.exports = app => app.component('list-subdocument', {
  template: template,
  props: ['value'],
  computed: {
    shortenValue() {
      return this.value;
    }
  },
  mounted: function() {
    Prism.highlightElement(this.$refs.SubDocCode);
  }
});
