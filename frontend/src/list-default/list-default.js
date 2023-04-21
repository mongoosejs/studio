'use strict';

const template = require('./list-default.html');
const appendCSS = require('../appendCSS');

appendCSS(require('./list-default.css'));

module.exports = app => app.component('list-default', {
  template: template,
  props: ['value'],
  methods: {
    copyText(value) {
      console.log('I have been clicked!')
      const storage = document.createElement('textarea');
      storage.value = value;
      const elem = document.querySelector('#value-field');
      elem.appendChild(storage);
      storage.select();
      storage.setSelectionRange(0, 99999);
      document.execCommand('copy');
      elem.removeChild(storage);

    }
  },
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