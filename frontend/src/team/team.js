'use strict';

const api = require('../api');
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
    status: 'loading',
    alertWizardStep: 0,
    alertSteps: [
      { key: 'event', label: 'Choose event' },
      { key: 'scope', label: 'Scope' },
      { key: 'action', label: 'Actions' },
      { key: 'test', label: 'Test & enable' }
    ],
    alertEventOptions: [
      { value: 'insert', label: 'Insert', description: 'Alert on new documents.' },
      { value: 'update', label: 'Update', description: 'Alert when documents are updated.' },
      { value: 'delete', label: 'Delete', description: 'Alert when documents are removed.' },
      { value: 'upsert', label: 'Insert or Update', description: 'Alert when documents are inserted or updated.' }
    ],
    alertTemplates: [
      {
        id: 'high-value-order',
        name: '🚨 High-value order',
        body: [
          '🚨 New high-value order',
          '',
          'Order ID: {{_id}}',
          'User: {{user.email}}',
          'Total: ${{total}}',
          'Created at: {{createdAt}}',
          '',
          'View in Studio → {{studioLink}}'
        ].join('\n')
      },
      {
        id: 'inventory',
        name: '📦 Inventory change',
        body: [
          '📦 Inventory updated',
          '',
          'SKU: {{sku}}',
          'Name: {{name}}',
          'Quantity: {{quantity}}',
          'Updated: {{updatedAt}}',
          '',
          'View in Studio → {{studioLink}}'
        ].join('\n')
      }
    ],
    alertConfig: {
      _id: null,
      eventType: 'insert',
      database: '',
      collection: '',
      slackChannel: '',
      templateId: 'high-value-order',
      templateText: '',
      enabled: false
    },
    alertSampleDocument: {
      _id: 'ord_84b2d1',
      user: { email: 'ava@acme.co' },
      total: 1284.5,
      createdAt: '2024-03-12T09:41:22Z',
      sku: 'ACME-STEEL-42',
      name: 'Steel Widget',
      quantity: 34,
      updatedAt: '2024-03-13T11:05:11Z',
      studioLink: 'https://studio.mongoosejs.io/#/model/orders/document/ord_84b2d1'
    },
    isSendingTest: false,
    testAlertStatus: null,
    isSavingAlert: false,
    alertSaveStatus: null
  }),
  async mounted() {
    window.pageState = this;

    const { workspace, users, invitations } = await mothership.getWorkspaceTeam();
    this.workspace = workspace;
    this.users = users;
    this.invitations = invitations;
    this.status = 'loaded';
    await this.loadAlerts();
    this.applyTemplatePreset();
  },
  computed: {
    paymentLink() {
      return 'https://buy.stripe.com/3csaFg8XTdd0d6U7sy?client_reference_id=' + this.workspace?._id;
      // return 'https://buy.stripe.com/test_eVaeYa2jC7565Lq7ss?client_reference_id=' + this.workspace?._id;
    },
    alertVariables() {
      return [
        '_id',
        'user.email',
        'total',
        'createdAt',
        'sku',
        'name',
        'quantity',
        'updatedAt',
        'studioLink'
      ];
    },
    alertTemplatePreview() {
      return this.renderTemplate(this.alertConfig.templateText, this.alertSampleDocument);
    },
    formattedSampleDocument() {
      return JSON.stringify(this.alertSampleDocument, null, 2);
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
      const nonOwnerRoles = roles.filter(role => role !== 'owner');
      const currentRole = nonOwnerRoles[0] ?? null;
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
    },
    async loadAlerts() {
      const { alerts } = await api.Alert.listAlerts({ workspaceId: this.workspace?._id });
      if (alerts?.length) {
        const alert = alerts[0];
        this.alertConfig = {
          _id: alert._id,
          eventType: alert.eventType ?? 'insert',
          database: alert.database ?? '',
          collection: alert.collection ?? '',
          slackChannel: alert.slackChannel ?? '',
          templateId: this.alertConfig.templateId,
          templateText: alert.templateText ?? '',
          enabled: !!alert.enabled
        };
      }
    },
    applyTemplatePreset() {
      const selected = this.alertTemplates.find(template => template.id === this.alertConfig.templateId);
      if (selected && !this.alertConfig.templateText) {
        this.alertConfig.templateText = selected.body;
      }
    },
    async advanceAlertStep() {
      this.alertSaveStatus = null;
      if (this.alertWizardStep < this.alertSteps.length - 1) {
        this.alertWizardStep += 1;
      } else {
        await this.saveAlert();
      }
    },
    async saveAlert() {
      this.isSavingAlert = true;
      this.alertSaveStatus = null;
      try {
        const payload = {
          alertId: this.alertConfig._id,
          workspaceId: this.workspace?._id,
          eventType: this.alertConfig.eventType,
          database: this.alertConfig.database,
          collection: this.alertConfig.collection,
          slackChannel: this.alertConfig.slackChannel,
          templateText: this.alertConfig.templateText,
          enabled: this.alertConfig.enabled
        };

        let response;
        if (this.alertConfig._id) {
          response = await api.Alert.updateAlert(payload);
        } else {
          response = await api.Alert.createAlert(payload);
          this.alertConfig._id = response.alert?._id || this.alertConfig._id;
        }
        this.alertSaveStatus = { type: 'success', message: 'Alert saved.' };
        this.alertWizardStep = 0;
      } catch (error) {
        this.alertSaveStatus = { type: 'error', message: error.message || 'Unable to save alert.' };
      } finally {
        this.isSavingAlert = false;
      }
    },
    insertVariable(variable) {
      const token = `{{${variable}}}`;
      const input = this.$refs.alertTemplateInput;
      if (!input || typeof input.selectionStart !== 'number') {
        this.alertConfig.templateText = `${this.alertConfig.templateText} ${token}`.trim();
        return;
      }

      const start = input.selectionStart;
      const end = input.selectionEnd;
      const current = this.alertConfig.templateText;
      this.alertConfig.templateText = `${current.slice(0, start)}${token}${current.slice(end)}`;
      this.$nextTick(() => {
        input.focus();
        const cursor = start + token.length;
        input.setSelectionRange(cursor, cursor);
      });
    },
    getValueByPath(object, path) {
      return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), object);
    },
    renderTemplate(template, sample) {
      return template.replace(/{{\s*([^}]+)\s*}}/g, (_match, path) => {
        const value = this.getValueByPath(sample, path.trim());
        return value === null ? '—' : String(value);
      });
    },
    async sendTestAlert() {
      this.isSendingTest = true;
      this.testAlertStatus = null;
      try {
        await api.Alert.sendTestAlert({
          workspaceId: this.workspace?._id,
          slackChannel: this.alertConfig.slackChannel,
          templateText: this.alertConfig.templateText,
          sampleDocument: this.alertSampleDocument
        });
        this.testAlertStatus = { type: 'success', message: 'Test alert sent successfully.' };
      } catch (error) {
        this.testAlertStatus = { type: 'error', message: error.message || 'Unable to send test alert.' };
      } finally {
        this.isSendingTest = false;
      }
    }
  }
});
