'use strict';

const mothership = require('../../mothership');
const template = require('./new-invitation.html');

module.exports = app => app.component('new-invitation', {
  template,
  emits: ['close'],
  data: () => ({
    githubUsername: '',
    email: ''
  }),
  methods: {
    async inviteToWorkspace() {
      await mothership.inviteToWorkspace({ githubUsername: this.githubUsername, email: this.email });
      this.$emit('close');
    }
  }
});
