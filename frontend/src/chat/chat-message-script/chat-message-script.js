'use strict';

const api = require('../../api');
const template = require('./chat-message-script.html');
const vanillatoasts = require('vanillatoasts');

module.exports = app => app.component('chat-message-script', {
  template,
  props: ['message', 'script', 'language'],
  data() {
    return {
      activeTab: 'code',
      showDetailModal: false,
      showCreateDashboardModal: false,
      newDashboardTitle: '',
      dashboardCode: '',
      createErrors: [],
      dashboardEditor: null
    };
  },
  computed: {
    styleForMessage() {
      return this.message.role === 'user' ? 'bg-gray-100' : '';
    }
  },
  methods: {
    async executeScript(message, script) {
      const { chatMessage } = await api.ChatMessage.executeScript({
        chatMessageId: message._id,
        script
      });
      message.executionResult = chatMessage.executionResult;
      this.activeTab = 'output';
    },
    openDetailModal() {
      this.showDetailModal = true;
    },
    openCreateDashboardModal() {
      this.newDashboardTitle = '';
      this.dashboardCode = this.script;
      this.createErrors = [];
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
    async createDashboardFromScript() {
      this.dashboardCode = this.dashboardEditor.getValue();
      const { dashboard } = await api.Dashboard.createDashboard({
        code: this.dashboardCode,
        title: this.newDashboardTitle
      }).catch(err => {
        if (err.response?.data?.message) {
          console.log(err.response.data);
          const message = err.response.data.message.split(': ').slice(1).join(': ');
          this.createErrors = message.split(',').map(error => {
            return error.split(': ').slice(1).join(': ').trim();
          });
          throw new Error(err.response?.data?.message);
        }
        throw err;
      });
      this.createErrors.length = 0;
      this.showCreateDashboardModal = false;
      this.$router.push('/dashboard/' + dashboard._id);
    },
    async copyOutput() {
      await navigator.clipboard.writeText(this.message.executionResult.output);
      vanillatoasts.create({
        title: 'Text copied!',
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
    }
  },
  mounted() {
    Prism.highlightElement(this.$refs.code);
    if (this.message.executionResult?.output) {
      this.activeTab = 'output';
    }
  }
});
