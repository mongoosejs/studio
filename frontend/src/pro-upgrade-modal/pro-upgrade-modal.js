'use strict';

const template = require('./pro-upgrade-modal.html');

module.exports = app => app.component('pro-upgrade-modal', {
  template,
  props: {
    show: { type: Boolean, default: false },
    featureDescription: { type: String, default: 'This feature is available on the Pro plan.' }
  },
  emits: ['close'],
  watch: {
    show(val) {
      if (val) {
        this.$nextTick(() => {
          if (this.$refs.overlay) {
            this.$refs.overlay.focus();
          }
        });
      }
    }
  }
});
