'use strict';

const mothership = require('../mothership');
const template = require('./team.html');

module.exports = app => app.component('team', {
  template,
  data: () => ({
    workspace: null,
    users: null,
    invitations: null,
    showNewInvitationModal: false,
    showRemoveModal: null
  }),
  async mounted() {
    const { workspace, users, invitations } = await mothership.getWorkspaceTeam();
    this.workspace = workspace;
    this.users = users;
    this.invitations = invitations;
  },
  computed: {
    paymentLink() {
      return 'https://buy.stripe.com/test_eVaeYa2jC7565Lq7ss?client_reference_id=' + this.workspace?._id;
    }
  },
  methods: {
    getRolesForUser(user) {
      return this.workspace.members.find(member => member.userId === user._id)?.roles ?? [];
    },
    async removeFromWorkspace() {
      const { workspace, users } = await mothership.removeFromWorkspace({ userId: this.showRemoveModal._id });
      this.workspace = workspace;
      this.users = users;
      this.showRemoveModal = false;
    },
    async getWorkspaceCustomerPortalLink() {
      const { url } = await mothership.getWorkspaceCustomerPortalLink();
      window.open(url, '_self');
    }
  }
});
