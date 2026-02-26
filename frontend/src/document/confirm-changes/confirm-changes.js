'use strict';

const template = require('./confirm-changes.html');

module.exports = app => app.component('confirm-changes', {
  template: template,
  props: ['value'],
  computed: {
    displayValue() {
      const hasUnsetFields = Object.keys(this.value).some(key => this.value[key] === undefined);
      if (hasUnsetFields) {
        const unsetFields = Object.keys(this.value)
          .filter(key => this.value[key] === undefined)
          .reduce((obj, key) => Object.assign(obj, { [key]: 1 }), {});
        const setFields = Object.keys(this.value)
          .filter(key => this.value[key] !== undefined)
          .reduce((obj, key) => Object.assign(obj, { [key]: this.value[key] }), {});
        return JSON.stringify({ $set: setFields, $unset: unsetFields }, null, '  ').trim();
      }
      return JSON.stringify(this.value, null, '  ').trim();
    }
  },
  methods: {
    closeConfirm() {
      this.$emit('close');
    },
    startSave() {
      this.$emit('save');
    }
  },
  mounted() {
    Prism.highlightElement(this.$refs.code);
  }
});
