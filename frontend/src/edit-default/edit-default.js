'use strict';

const template = require('./edit-default.html');

module.exports = app => app.component('edit-default', {
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