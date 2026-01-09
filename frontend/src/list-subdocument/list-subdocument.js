'use strict';

const api = require('../api');
const template = require('./list-subdocument.html');

require('../appendCSS')(require('./list-subdocument.css'));

module.exports = app => app.component('list-subdocument', {
  template: template,
  props: ['value'],
  data: () => ({ showViewDataModal: false }),
  computed: {
    shortenValue() {
      if (this.value == null) {
        return this.value;
      }
      const value = JSON.stringify(this.value);
      if (value.length > 50) {
        return `${value.slice(0, 50)}…`;
      }
      return value;
    }
  },
  methods: {
    copyText(value) {
      const storage = document.createElement('textarea');
      storage.value = JSON.stringify(value);
      const elem = this.$el;
      elem.appendChild(storage);
      storage.select();
      storage.setSelectionRange(0, 99999);
      document.execCommand('copy');
      elem.removeChild(storage);
      this.$toast.success('Text copied!');
    }
  }
});
