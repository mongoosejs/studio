

'use strict';

const template = require('./dashboard-document.html');

module.exports = app => app.component('dashboard-document', {
  template: template,
  props: ['value'],
  inject: ['state'],
  computed: {
    references() {
      const model = this.value.$document.model || 'User';
      if (typeof model === 'string' && this.state.modelSchemaPaths?.[model]) {
        const map = {};
        for (const path of Object.keys(this.state.modelSchemaPaths[model])) {
          const definition = this.state.modelSchemaPaths[model][path];
          if (definition?.ref) {
            map[path] = definition.ref;
          }
        }
        return map;
      }

      return null;
    }
  }
});
