/* global Prism */
'use strict';

const api = require('../../api');
const template = require('./chat-message-script.html');

module.exports = app => app.component('chat-message-script', {
  template,
  props: ['message', 'script', 'language', 'targetDashboardId'],
  emits: ['copyMessage'],
  data() {
    return {
      activeTab: 'code',
      showDetailModal: false,
      showCreateDashboardModal: false,
      showOverwriteDashboardConfirmationModal: false,
      showDropdown: false,
      newDashboardTitle: '',
      dashboardCode: '',
      createError: null,
      isEditing: false,
      editedScript: null,
      overwriteDashboardCode: '',
      overwriteError: null
    };
  },
  computed: {
    styleForMessage() {
      return this.message.role === 'user' ? 'bg-muted' : '';
    },
    canOverwriteDashboard() {
      return !!this.targetDashboardId;
    }
  },
  methods: {
    async executeScript() {
      const scriptToRun = this.isEditing ? this.editedScript : this.script;
      this.editedScript = scriptToRun;
      const { chatMessage } = await api.ChatMessage.executeScript({
        chatMessageId: this.message._id,
        script: scriptToRun
      });
      this.message.executionResult = chatMessage.executionResult;
      this.message.script = chatMessage.script;
      this.message.content = chatMessage.content;
      this.editedScript = chatMessage.script;
      if (this.isEditing) {
        this.finishEditing();
      } else {
        this.highlightCode();
      }
      this.activeTab = 'output';
      this.$toast.success('Script executed successfully!');
      return chatMessage;
    },
    openDetailModal() {
      this.showDetailModal = true;
    },
    openCreateDashboardModal() {
      this.newDashboardTitle = '';
      this.dashboardCode = this.script;
      this.createError = null;
      this.showCreateDashboardModal = true;
    },
    openOverwriteDashboardConfirmation() {
      if (!this.canOverwriteDashboard) {
        return;
      }
      this.overwriteDashboardCode = this.isEditing ? this.editedScript : this.script;
      this.overwriteError = null;
      this.showOverwriteDashboardConfirmationModal = true;
    },
    toggleDropdown() {
      this.showDropdown = !this.showDropdown;
    },
    startEditing() {
      this.isEditing = true;
      this.editedScript = this.script;
    },
    cancelEditing() {
      this.isEditing = false;
      this.editedScript = this.script;
      this.highlightCode();
    },
    finishEditing() {
      this.isEditing = false;
      this.highlightCode();
    },
    handleScriptInput(event) {
      this.editedScript = event?.target?.value || '';
    },
    highlightCode() {
      this.$nextTick(() => {
        if (this.$refs.code) {
          Prism.highlightElement(this.$refs.code);
        }
      });
    },
    handleBodyClick(event) {
      const dropdown = this.$refs.dropdown;
      if (dropdown && typeof dropdown.contains === 'function' && !dropdown.contains(event.target)) {
        this.showDropdown = false;
      }
    },
    async createDashboardFromScript() {
      const { dashboard } = await api.Dashboard.createDashboard({
        code: this.dashboardCode || '',
        title: this.newDashboardTitle
      }).catch(err => {
        if (err.response?.data?.message) {
          const message = err.response.data.message.split(': ').slice(1).join(': ');
          this.createError = message;
          throw new Error(err.response?.data?.message);
        }
        throw err;
      });
      this.createError = null;
      this.$toast.success('Dashboard created!');
      this.showCreateDashboardModal = false;
      this.$router.push('/dashboard/' + dashboard._id);
    },
    async confirmOverwriteDashboard() {
      if (!this.canOverwriteDashboard) {
        this.overwriteError = 'This chat is not linked to a dashboard.';
        return;
      }

      this.overwriteDashboardCode = this.isEditing ? this.editedScript : this.script;

      const params = {
        dashboardId: this.targetDashboardId,
        code: this.overwriteDashboardCode
      };

      const { doc } = await api.Dashboard.updateDashboard(params).catch(err => {
        if (err.response?.data?.message) {
          const message = err.response.data.message.split(': ').slice(1).join(': ');
          this.overwriteError = message;
          throw new Error(err.response?.data?.message);
        }
        throw err;
      });

      this.overwriteError = null;
      this.$toast.success('Dashboard updated!');
      this.showOverwriteDashboardConfirmationModal = false;
      this.$router.push('/dashboard/' + doc._id);
    },
    async copyOutput() {
      const executionResult = this.message.executionResult || {};
      let output = executionResult.output;
      if (output != null && typeof output === 'object') {
        output = JSON.stringify(output, null, 2);
      }

      const logs = executionResult.logs;
      const parts = [];
      if (output != null) {
        parts.push(output);
      }
      if (logs) {
        parts.push(logs);
      }

      await navigator.clipboard.writeText(parts.join('\n\n'));
      this.$toast.success('Code output copied!');
    }
  },
  watch: {
    script(newScript) {
      if (!this.isEditing) {
        this.editedScript = newScript;
        this.highlightCode();
      }
    }
  },
  mounted() {
    this.highlightCode();
    this.$nextTick(() => {
      document.body.addEventListener('click', this.handleBodyClick);
    });
    if (this.message.executionResult?.output || this.message.executionResult?.logs) {
      this.activeTab = 'output';
    }
  },
  unmounted() {
    document.body.removeEventListener('click', this.handleBodyClick);
  }
});
