'use strict';

const template = require('./edit-date.html');

module.exports = app => app.component('edit-date', {
  template: template,
  props: ['value', 'format'],
  emits: ['input'],
  methods: {
    updateFromISO($event) {
      const value = $event.target.value;
      if (value == null) {
        return this.$emit('input', $event.target.value);
      }
      if (value === 'null') {
        return this.$emit('input', null);
      }
      if (value === 'undefined') {
        return this.$emit('input', undefined);
      }
      const valueAsDate = new Date(value);
      if (!isNaN(valueAsDate.valueOf())) {
        this.$emit('input', $event.target.value);
      }
    }
  },
  computed: {
    valueAsISOString() {
      if (this.value == null) {
        return '' + this.value;
      }
      const date = new Date(this.value);
      return date.toISOString();
    },
    dateSelection() {
      return this.format;
    }
  }
});
