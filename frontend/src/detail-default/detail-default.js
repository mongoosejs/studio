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
      if (typeof this.value === 'string') {
        return this.value;
      }
      if (typeof this.value === 'number' || typeof this.value === 'boolean' || typeof this.value === 'bigint') {
        return String(this.value);
      }
      try {
        return JSON.stringify(this.value, null, 2);
      } catch (err) {
        return String(this.value);
      }
    }
  }
});