'use strict';

const template = require('./list-array.html');

require('../appendCSS')(require('./list-array.css'));

module.exports = app => app.component('list-array', {
  template: template,
  props: ['value'],
  computed: {
    displayValue() {
      return JSON.stringify(this.value, (key, value) => {
        if (typeof value === 'string' && value.length > 30) {
          return value.slice(0, 27) + '...';
        }
        return value;
      }, '  ').trim();
    }
  },
  mounted() {
    Prism.highlightElement(this.$refs.code);
  }
});