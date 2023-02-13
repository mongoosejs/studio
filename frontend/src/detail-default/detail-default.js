'use strict';

const template = require('./detail-default.html');

module.exports = app => app.component('detail-default', {
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