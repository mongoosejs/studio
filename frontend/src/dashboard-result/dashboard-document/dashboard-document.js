

'use strict';

const template = require('./dashboard-document.html');

module.exports = app => app.component('dashboard-document', {
  template: template,
  props: ['value'],
  computed: {
    header() {
      if (this.value != null && this.value.$document.header) {
        return this.value.$document.header;
      }
      return null;
    },
    schemaPaths() {
      return Object.keys(this.value.$document.schemaPaths).sort((k1, k2) => {
        if (k1 === '_id' && k2 !== '_id') {
          return -1;
        }
        if (k1 !== '_id' && k2 === '_id') {
          return 1;
        }
        return 0;
      }).map(key => this.value.$document.schemaPaths[key]);
    }
  }
});
