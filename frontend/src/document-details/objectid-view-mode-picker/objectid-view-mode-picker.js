'use strict';

const template = require('./objectid-view-mode-picker.html');

module.exports = app => app.component('objectid-view-mode-picker', {
  template,
  props: ['viewMode'],
  emits: ['update:viewMode'],
  computed: {
    format() {
      return this.viewMode || 'hex';
    }
  },
  methods: {
    onFormatChange(newFormat) {
      this.$emit('update:viewMode', newFormat);
    }
  }
});
