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
    },
    onEnter(event) {
      if (event.key !== 'Enter') {
        return;
      }

      const modalMasks = Array.from(document.querySelectorAll('.modal-mask'));
      const currentMask = this.$el?.closest('.modal-mask');
      const isTopMostModal = modalMasks.length > 0 && modalMasks[modalMasks.length - 1] === currentMask;

      if (!isTopMostModal) {
        return;
      }

      event.preventDefault();
      this.startSave();
    }
  },
  mounted() {
    window.addEventListener('keydown', this.onEnter);
    Prism.highlightElement(this.$refs.code);
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.onEnter);
  }
});
