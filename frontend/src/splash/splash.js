'use strict';

const mothership = require('../mothership');
const template = require('./splash.html');

module.exports = app => app.component('splash', {
  template,
  inject: ['state'],
  props: ['loading'],
  data: () => ({ error: null }),
  computed: {
    workspaceName() {
      return window.MONGOOSE_STUDIO_CONFIG.workspace.name;
    }
  },
  methods: {
    async loginWithGithub() {
      const { url } = await mothership.githubLogin();
      window.location.href = url;
    }
  }
});
