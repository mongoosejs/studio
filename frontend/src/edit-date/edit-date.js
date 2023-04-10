'use strict';

const template = require('./edit-date.html');

module.exports = app => app.component('edit-date', {
  template: template,
  props: ['value'],
  emits: ['input'],
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