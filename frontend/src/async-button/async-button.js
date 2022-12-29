'use strict';

const template = require('./async-button.html');

module.exports = app => app.component('async-button', {
  data: () => ({
    status: 'init'
  }),
  inheritAttrs: false,
  methods: {
    async handleClick(ev) {
      if (this.status === 'in_progress') {
        return;
      }
      this.status = 'in_progress';

      try {
        await this.$attrs.onClick(ev);
      } catch (err) {
        this.status = 'error';
        throw err;
      }

      this.status = 'success';
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