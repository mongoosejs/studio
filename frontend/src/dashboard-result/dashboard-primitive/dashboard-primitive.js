

'use strict';

const template = require('./dashboard-primitive.html');

module.exports = app => app.component('dashboard-primitive', {
  template: template,
  props: ['value'],
  computed: {
    header() {
      if (this.value != null && this.value.$primitive.header) {
        return this.value.$primitive.header;
      }
      return null;
    },
    displayValue() {
      if (this.value != null && this.value.$primitive) {
        return this.value.$primitive.value;
      }
      return this.value;
    }
  }
});
