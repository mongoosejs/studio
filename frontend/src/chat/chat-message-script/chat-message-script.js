'use strict';

const api = require('../../api');
const marked = require('marked').marked;
const template = require('./chat-message-script.html');

module.exports = app => app.component('chat-message-script', {
  template: template,
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
    }
  },
  mounted() {
    Prism.highlightElement(this.$refs.code);
    if (this.message.executionResult?.output) {
      this.activeTab = 'output';
    }
  }
});
