'use strict';

const api = require('../api');
const template = require('./list-json.html');

const vanillatoast = require('vanillatoasts');

require('../appendCSS')(require('./list-json.css'));

module.exports = app => app.component('list-json', {
  template: template,
  props: ['value'],
  computed: {
    shortenValue() {
      return JSON.stringify(this.value, null, 8);
    }
  },
  methods: {
    copyText(value) {
      const storage = document.createElement('textarea');
      storage.value = JSON.stringify(value);
      const elem = this.$refs.JSONCode;
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
  mounted: function() {
    Prism.highlightElement(this.$refs.JSONCode);
  }
});
