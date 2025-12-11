'use strict';

const template = require('./async-button.html');

module.exports = app => app.component('async-button', {
  data: () => ({
    status: 'init'
  }),
  inheritAttrs: false,
  methods: {
    async handleClick(ev) {
      if (this.status === 'in_progress') return;

      const btn = this.$el;
      const prevWidth = btn.offsetWidth;
      const prevHeight = btn.offsetHeight;
      btn.style.width = `${prevWidth}px`;
      btn.style.height = `${prevHeight}px`;

      this.status = 'in_progress';

      try {
        if (typeof this.$attrs.onClick === 'function') {
          await this.$attrs.onClick(ev);
        }
        this.status = 'success';
      } catch (err) {
        this.status = 'init';
        throw err;
      } finally {
        btn.style.width = null;
        btn.style.height = null;
      }
    }
  },
  computed: {
    attrsToBind() {
      const attrs = { ...this.$attrs };
      delete attrs.onClick;
      delete attrs.disabled;
      return attrs;
    },
    isDisabled() {
      return this.status === 'in_progress' || this.$attrs.disabled;
    }
  },
  template: template
});
