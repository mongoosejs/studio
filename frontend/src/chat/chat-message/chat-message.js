'use strict';

const api = require('../../api');
const marked = require('marked').marked;
const vanillatoasts = require('vanillatoasts');
const template = require('./chat-message.html');

module.exports = app => app.component('chat-message', {
  template: template,
  props: ['message', 'targetDashboardId'],
  computed: {
    styleForMessage() {
      return this.message.role === 'user' ? 'p-3 bg-gray-100' : 'py-3 pr-3';
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
      vanillatoasts.create({
        title: 'Script executed successfully!',
        type: 'success',
        timeout: 3000,
        icon: 'images/success.png',
        positionClass: 'bottomRight'
      });
    },
    async copyMessage() {
      const parts = this.contentSplitByScripts;
      let output = '';
      for (const part of parts) {
        if (part.type === 'text') {
          output += part.content + '\n';
        } else if (part.type === 'code') {
          let result = this.message.executionResult?.output;
          if (result != null && typeof result === 'object') {
            result = JSON.stringify(result, null, 2);
          }
          if (result) {
            let executionOutput = this.message.executionResult?.output;
            if (executionOutput != null && typeof executionOutput === 'object') {
              executionOutput = JSON.stringify(executionOutput, null, 2);
            }
            if (executionOutput) {
              output += '```\n' + executionOutput + '\n```\n';
            }
          }
        }
      }
      await navigator.clipboard.writeText(output.trim());
      vanillatoasts.create({
        title: 'Message output copied!',
        type: 'success',
        timeout: 3000,
        icon: 'images/success.png',
        positionClass: 'bottomRight'
      });
    }
  }
});
