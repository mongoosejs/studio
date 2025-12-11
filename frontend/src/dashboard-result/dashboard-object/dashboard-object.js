'use strict';

const template = require('./dashboard-object.html');

module.exports = app => app.component('dashboard-object', {
  template: template,
  props: ['value'],
  computed: {
    header() {
      return this.value?.header || null;
    },
    formattedValue() {
      try {
        return JSON.stringify(this.value, null, 2);
      } catch (err) {
        return String(this.value);
      }
    }
  }
});
