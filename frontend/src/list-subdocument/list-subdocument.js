'use strict';

const api = require('../api');
const template = require('./list-subdocument.html');

require('../appendCSS')(require('./list-subdocument.css'));

module.exports = app => app.component('list-subdocument', {
  template: template,
  props: ['value'],
  computed: {
    shortenValue() {
      return this.value;
    }
  },
  methods: {
    copyText(value) {
      const storage = document.createElement('textarea');
      storage.value = JSON.stringify(value);
      const elem = this.$refs.SubDocCode;
      elem.appendChild(storage);
      storage.select();
      storage.setSelectionRange(0, 99999);
      document.execCommand('copy');
      elem.removeChild(storage);
      this.$toast.success('Text copied!');
    }
  },
  mounted: function() {
    Prism.highlightElement(this.$refs.SubDocCode);
  }
});