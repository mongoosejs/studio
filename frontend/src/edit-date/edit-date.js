'use strict';

const template = require('./edit-date.html');

module.exports = app => app.component('edit-date', {
  template: template,
  props: ['value', 'format'],
  emits: ['input'],
  data: () => ({
    inputType: ''
  }),
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
    valueAsLocalString() {
      if (this.value == null) {
        return this.value;
      }
      const date = new Date(this.value);
      return [
        date.getFullYear(),
        '-',
        (date.getMonth() + 1).toString().padStart(2, '0'),
        '-',
        date.getDate().toString().padStart(2, '0'),
        'T',
        date.getHours().toString().padStart(2, '0'),
        ':',
        date.getMinutes().toString().padStart(2, '0')
      ].join('');
    },
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
