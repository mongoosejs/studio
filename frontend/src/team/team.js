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
    showRemoveModal: null,
    showEditModal: null,
    status: 'loading'
  }),
  async mounted() {
    window.pageState = this;

    const { workspace, users, invitations } = await mothership.getWorkspaceTeam();
    this.workspace = workspace;
    this.users = users;
    this.invitations = invitations;
    this.status = 'loaded';
  },
  computed: {
    paymentLink() {
      return 'https://buy.stripe.com/3csaFg8XTdd0d6U7sy?client_reference_id=' + this.workspace?._id;
      // return 'https://buy.stripe.com/test_eVaeYa2jC7565Lq7ss?client_reference_id=' + this.workspace?._id;
    }
  },
  methods: {
    getRolesForUser(user) {
      return this.workspace.members.find(member => member.userId === user._id)?.roles ?? [];
    },
    openEditModal(user) {
      if (this.getRolesForUser(user).includes('owner')) {
        return;
      }

      const roles = this.getRolesForUser(user);
      const currentRole = roles.find(role => role !== 'owner') ?? roles[0] ?? null;
      const editableRole = currentRole ?? (this.workspace?.subscriptionTier ? 'member' : 'dashboards');

      this.showEditModal = {
        user,
        role: editableRole,
        originalRole: currentRole
      };
    },
    closeEditModal() {
      this.showEditModal = null;
    },
    async updateWorkspaceMember() {
      if (this.showEditModal.role === this.showEditModal.originalRole) {
        this.closeEditModal();
        return;
      }

      const { workspace, users } = await mothership.updateWorkspaceMember({
        userId: this.showEditModal.user._id,
        roles: [this.showEditModal.role]
      });

      this.workspace = workspace;
      this.users = users;
      this.closeEditModal();
    },
    async removeFromWorkspace() {
      const { workspace, users } = await mothership.removeFromWorkspace({ userId: this.showRemoveModal._id });
      this.workspace = workspace;
      this.users = users;
      this.showRemoveModal = null;
    },
    async getWorkspaceCustomerPortalLink() {
      const { url } = await mothership.getWorkspaceCustomerPortalLink();
      window.open(url, '_self');
    },
    disableRoleOption(option) {
      if (this.workspace?.subscriptionTier) {
        return false;
      }

      if (this.showEditModal?.originalRole === option) {
        return false;
      }

      return option !== 'dashboards';
    }
  }
});
