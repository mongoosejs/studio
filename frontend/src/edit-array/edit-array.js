'use strict';

const template = require('./edit-array.html');

const appendCSS = require('../appendCSS');
appendCSS(require('./edit-array.css'));

module.exports = app => app.component('edit-array', {
  template: template,
  props: ['value'],
  data: () => ({ currentValue: null }),
  mounted() {
    this.currentValue = this.value;
  },
  methods: {
    onUpdate() {
      this.$emit('input', this.currentValue);
    },
    removeValue(i) {
      this.currentValue.splice(i, 1);
      this.$emit('input', this.currentValue);
    }
  },
  emits: ['input']
});
