'use strict';

const template = require('./list-array.html');

module.exports = app => app.component('list-array', {
  template: template,
  props: ['value'],
  data: () => ({ showViewDataModal: false }),
  computed: {
    displayValue() {
      if (this.value == null) {
        return this.value;
      }
      const value = JSON.stringify(this.value);
      if (value.length > 50) {
        return `${value.slice(0, 50)}…`;
      }
      return value;
    }
  }
});
