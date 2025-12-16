'use strict';

const template = require('./list-default.html');
const appendCSS = require('../appendCSS');

appendCSS(require('./list-default.css'));

module.exports = app => app.component('list-default', {
  template: template,
  props: ['value', 'allude'],
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
      this.$toast.success('Text copied!');
    },
    goToDoc(id) {
      this.$router.push({ path: `/model/${this.allude}/document/${id}` });
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
      if (this.value.length > 30) {
        return this.value.substring(0, 30) + '...';
      }
      return this.value;
    },
    hasReference() {
      return this.allude;
    }
  }
});