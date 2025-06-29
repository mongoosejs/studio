'use strict';

const api = require('../../api');
const marked = require('marked').marked;
const template = require('./chat-message.html');

module.exports = app => app.component('chat-message', {
  template: template,
  props: ['message'],
  computed: {
    styleForMessage() {
      return this.message.role === 'user' ? 'bg-gray-100' : '';
    },
    contentSplitByScripts() {
      const content = this.message.content;
      const parts = [];
      let currentIndex = 0;
      let codeBlockMatch;

      // Regular expression to match markdown code blocks
      const codeBlockRegex = /```(\w*)\n([\s\S]*?)\n```/g;

      while ((codeBlockMatch = codeBlockRegex.exec(content)) !== null) {
        // Add text before the code block
        if (codeBlockMatch.index > currentIndex) {
          parts.push({
            type: 'text',
            content: content.substring(currentIndex, codeBlockMatch.index)
          });
        }

        // Add the code block
        parts.push({
          type: 'code',
          language: codeBlockMatch[1] || '',
          content: codeBlockMatch[2]
        });

        currentIndex = codeBlockMatch.index + codeBlockMatch[0].length;
      }

      // Add any remaining text after the last code block
      if (currentIndex < content.length) {
        parts.push({
          type: 'text',
          content: content.substring(currentIndex)
        });
      }

      return parts;
    }
  },
  methods: {
    marked(text) {
      return marked(text);
    },
    async executeScript(message, script) {
      const { chatMessage } = await api.ChatMessage.executeScript({
        chatMessageId: message._id,
        script
      });
      message.executionResult = chatMessage.executionResult;
      console.log(message);
    }
  }
});
