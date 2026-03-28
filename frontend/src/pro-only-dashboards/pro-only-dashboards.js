'use strict';

const mothership = require('../mothership');
const template = require('./pro-only-dashboards.html');

module.exports = app => app.component('pro-only-dashboards', {
  template,
  computed: {
    hasWorkspace() {
      return !!window.MONGOOSE_STUDIO_CONFIG.workspace?._id;
    },
    upgradeLink() {
      if (this.hasWorkspace) {
        return mothership.getUpgradeLink;
      }
      return 'https://mongoosejs.com/studio';
    }
  }
});
