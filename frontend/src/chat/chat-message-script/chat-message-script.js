/* global CodeMirror, Prism */
'use strict';

const api = require('../../api');
const template = require('./chat-message-script.html');
const vanillatoasts = require('vanillatoasts');

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
      dashboardEditor: null,
      isEditing: false,
      codeEditor: null,
      editedScript: null,
      overwriteDashboardCode: '',
      overwriteError: null
    };
  },
  computed: {
    styleForMessage() {
      return this.message.role === 'user' ? 'bg-gray-100' : '';
    },
    canOverwriteDashboard() {
      return !!this.targetDashboardId;
    }
  },
  methods: {
    async executeScript() {
      let scriptToRun = this.script;
      if (this.isEditing) {
        scriptToRun = this.codeEditor ? this.codeEditor.getValue() : this.editedScript;
      }
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
      vanillatoasts.create({
        title: 'Script executed successfully!',
        type: 'success',
        timeout: 3000,
        icon: 'images/success.png',
        positionClass: 'bottomRight'
      });
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
      this.$nextTick(() => {
        if (this.dashboardEditor) {
          this.dashboardEditor.toTextArea();
        }
        this.$refs.dashboardCodeEditor.value = this.dashboardCode;
        this.dashboardEditor = CodeMirror.fromTextArea(this.$refs.dashboardCodeEditor, {
          mode: 'javascript',
          lineNumbers: true
        });
        this.dashboardEditor.on('change', () => {
          this.dashboardCode = this.dashboardEditor.getValue();
        });
      });
    },
    openOverwriteDashboardConfirmation() {
      if (!this.canOverwriteDashboard) {
        return;
      }
      this.overwriteDashboardCode = this.codeEditor?.getValue?.() ?? this.script;
      this.overwriteError = null;
      this.showOverwriteDashboardConfirmationModal = true;
    },
    toggleDropdown() {
      this.showDropdown = !this.showDropdown;
    },
    startEditing() {
      this.isEditing = true;
      this.editedScript = this.script;
      this.$nextTick(() => {
        if (!this.$refs.scriptEditor) {
          return;
        }
        this.$refs.scriptEditor.value = this.editedScript;
        if (typeof CodeMirror === 'undefined') {
          return;
        }
        this.destroyCodeMirror();
        this.codeEditor = CodeMirror.fromTextArea(this.$refs.scriptEditor, {
          mode: 'javascript',
          lineNumbers: true,
          smartIndent: false
        });
      });
    },
    cancelEditing() {
      this.isEditing = false;
      this.destroyCodeMirror();
      this.editedScript = this.script;
      this.highlightCode();
    },
    finishEditing() {
      this.isEditing = false;
      this.destroyCodeMirror();
      this.highlightCode();
    },
    destroyCodeMirror() {
      if (this.codeEditor) {
        this.codeEditor.toTextArea();
        this.codeEditor = null;
      }
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
      this.dashboardCode = this.dashboardEditor.getValue();
      const { dashboard } = await api.Dashboard.createDashboard({
        code: this.dashboardCode,
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
      vanillatoasts.create({
        title: 'Dashboard created!',
        type: 'success',
        timeout: 3000,
        icon: 'images/success.png',
        positionClass: 'bottomRight'
      });
      this.showCreateDashboardModal = false;
      this.$router.push('/dashboard/' + dashboard._id);
    },
    async confirmOverwriteDashboard() {
      if (!this.canOverwriteDashboard) {
        this.overwriteError = 'This chat is not linked to a dashboard.';
        return;
      }

      this.overwriteDashboardCode = this.codeEditor?.getValue?.() ?? this.script;

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
      vanillatoasts.create({
        title: 'Dashboard updated!',
        type: 'success',
        timeout: 3000,
        icon: 'images/success.png',
        positionClass: 'bottomRight'
      });
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
      vanillatoasts.create({
        title: 'Code output copied!',
        type: 'success',
        timeout: 3000,
        icon: 'images/success.png',
        positionClass: 'bottomRight'
      });
    }
  },
  watch: {
    showCreateDashboardModal(val) {
      if (!val && this.dashboardEditor) {
        this.dashboardEditor.toTextArea();
        this.dashboardEditor = null;
      }
    },
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
    this.destroyCodeMirror();
    document.body.removeEventListener('click', this.handleBodyClick);
  }
});
