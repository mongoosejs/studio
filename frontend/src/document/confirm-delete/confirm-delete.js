'use strict';

const template = require('./confirm-delete.html');

module.exports = app => app.component('confirm-delete', {
  template: template,
  props: ['value'],
  computed: {
    displayValue() {
      return JSON.stringify(this.value, null, '  ').trim();
    }
  },
  methods: {
    closeDelete() {
      this.$emit('close');
    },
    startDelete() {
      this.$emit('remove');
    }
  },
  mounted() {
    Prism.highlightElement(this.$refs.code);
  }
});