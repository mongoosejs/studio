'use strict';

const template = require('./confirm-changes.html');

module.exports = app => app.component('confirm-changes', {
  template: template,
  props: ['value'],
  computed: {
    displayValue() {
      return JSON.stringify(this.value, null, '  ').trim();
    }
  },
  methods: {
    closeConfirm() {
        this.$emit('close')
    },
    startSave() {
        this.$emit('save');
    }
  },
  mounted() {
    Prism.highlightElement(this.$refs.code);
  }
});