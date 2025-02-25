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
      return config__workspace.name;
    }
  },
  async mounted() {
    const href = window.location.href;
    if (href.match(/\?code=([a-zA-Z0-9]+)$/)) {
      const code = href.match(/\?code=([a-zA-Z0-9]+)$/)[1];
      const { accessToken, user, roles } = await mothership.github(code);
      if (roles == null) {
        this.error = 'You are not authorized to access this workspace';
        return;
      }
      this.state.user = user;
      window.localStorage.setItem('_mongooseStudioAccessToken', accessToken._id);
    }
  },
  methods: {
    async loginWithGithub() {
      const { url } = await mothership.githubLogin();
      window.location.href = url;
    }
  }
});
