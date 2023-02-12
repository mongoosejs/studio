'use strict';

const template = require('./list-default.html');

module.exports = app => app.component('list-default', {
  template: template,
  props: ['value'],
  computed: {
    displayValue() {
      if (this.value === null) {
        return 'null';
      }
      if (this.value === undefined) {
        return 'undefined';
      }
      return this.value;
    }
  }
});