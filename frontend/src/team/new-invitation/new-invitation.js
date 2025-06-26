'use strict';

const mothership = require('../../mothership');
const template = require('./new-invitation.html');

module.exports = app => app.component('new-invitation', {
  template,
  props: ['tier'],
  emits: ['close', 'invitationCreated'],
  data: () => ({
    githubUsername: '',
    email: '',
    role: null
  }),
  mounted() {
    if (this.tier == null) {
      this.role = 'dashboards';
    }
  },
  methods: {
    async inviteToWorkspace() {
      const { invitation } = await mothership.inviteToWorkspace({ githubUsername: this.githubUsername, email: this.email, roles: [this.role] });
      this.$emit('invitationCreated', { invitation });
      this.$emit('close');
    }
  }
});
