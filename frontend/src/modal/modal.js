'use strict';

const appendCSS = require('../appendCSS');
const template = require('./modal.html');

appendCSS(require('./modal.css'));

module.exports = app => app.component('modal', {
  template,
  props: ['containerClass'],
  mounted() {
    window.addEventListener('keydown', this.onEscape);
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.onEscape);
  },
  methods: {
    onEscape(event) {
      if (event.key !== 'Escape') {
        return;
      }

      const modalMasks = Array.from(document.querySelectorAll('.modal-mask'));
      const currentMask = this.$el?.classList?.contains('modal-mask') ? this.$el : this.$el?.querySelector('.modal-mask') || this.$el;
      const isTopMostModal = modalMasks.length > 0 && modalMasks[modalMasks.length - 1] === currentMask;

      if (!isTopMostModal) {
        return;
      }

      const closeButton = currentMask.querySelector('.modal-exit, [data-modal-close]');
      closeButton?.click();
    }
  }
});
