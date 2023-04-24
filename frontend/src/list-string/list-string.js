'use strict';

const template = require('./list-string.html');
const appendCSS = require('../appendCSS');
const vanillatoast = require('vanillatoasts');
appendCSS(require('./list-string.css'));

module.exports = app => app.component('list-string', {
  template: template,
  props: ['value'],
  methods: {
    copyText(value) {
      const storage = document.createElement('textarea');
      storage.value = value;
      const elem = this.$refs.itemData;
      elem.appendChild(storage);
      storage.select();
      storage.setSelectionRange(0, 99999);
      document.execCommand('copy');
      elem.removeChild(storage);
      vanillatoast.create({
        title: 'Text copied!',
        type: 'success',
        timeout: 3000,
        icon: 'images/success.png',
        positionClass: 'bottomRight'
      });
    }
  },
  computed: {
    displayValue() {
      if (!this.value) {
        return this.value;
      }

      if (this.value.length < 50) {
        return this.value;
      }

      return this.value.slice(0, 47) + '...';
    }
  }
});