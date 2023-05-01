'use strict';

const api = require('../api');
const template = require('./list-subdocument.html');

module.exports = app => app.component('list-subdocument', {
  template: template,
  props: ['value'],
  mounted: function() {
    Prism.highlightElement(this.$refs.SubDocCode);
  }
});