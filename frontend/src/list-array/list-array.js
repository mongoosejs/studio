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
