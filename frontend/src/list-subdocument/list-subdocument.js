'use strict';

const api = require('../api');
const template = require('./list-subdocument.html');

module.exports = app => app.component('list-subdocument', {
  template: template,
  props: ['value'],
  computed: {
    shortenValue() {
      const lines = this.value.split('\n');
      const limit = lines.slice(0, 5);
      for (let i = 0; i < limit.length; i++) {
        if (limit[i] != '\n' && limit[i].length > 30) {
          limit[i] = limit[i].substring(0, 30);
          limit[i] += '...';
        }
      }
    }
  },
  mounted: function() {
    Prism.highlightElement(this.$refs.SubDocCode);
  }
});