'use strict';

const api = require('../../api');
const template = require('./chat-message-script.html');
const vanillatoasts = require('vanillatoasts');

module.exports = app => app.component('chat-message-script', {
  template,
  props: ['message', 'script', 'language'],
  data: () => ({ activeTab: 'code', showDetailModal: false }),
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
  mounted() {
    Prism.highlightElement(this.$refs.code);
    if (this.message.executionResult?.output) {
      this.activeTab = 'output';
    }
  }
});
