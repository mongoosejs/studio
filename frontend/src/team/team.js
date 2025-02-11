'use strict';

const mothership = require('../mothership');
const template = require('./team.html');

module.exports = app => app.component('team', {
  template,
  data: () => ({
    workspace: null,
    users: null,
    invitations: null,
    showNewInvitationModal: false
  }),
  async mounted() {
    const { workspace, users, invitations } = await mothership.getWorkspaceTeam();
    this.workspace = workspace;
    this.users = users;
    this.invitations = invitations;
  },
  methods: {
    getRolesForUser(user) {
      return this.workspace.members.find(member => member.userId === user._id)?.roles ?? [];
    }
  }
});
