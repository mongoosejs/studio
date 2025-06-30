'use strict';

const api = require('../api');
const template = require('./chat.html');

module.exports = app => app.component('chat', {
  template: template,
  props: ['threadId'],
  data: () => ({
    status: 'loading',
    sendingMessage: false,
    newMessage: '',
    chatThreadId: null,
    chatThreads: [],
    chatMessages: [],
    hideSidebar: null
  }),
  methods: {
    async sendMessage() {
      this.sendingMessage = true;
      try {
        if (!this.chatThreadId) {
          const { chatThread } = await api.ChatThread.createChatThread();
          this.chatThreads.unshift(chatThread);
          this.chatThreadId = chatThread._id;
          this.chatMessages = [];
        }

        this.chatMessages.push({
          content: this.newMessage,
          role: 'user'
        });

        this.$nextTick(() => {
          if (this.$refs.messagesContainer) {
            this.$refs.messagesContainer.scrollTop = this.$refs.messagesContainer.scrollHeight;
          }
        });

        const { chatMessages } = await api.ChatThread.createChatMessage({
          chatThreadId: this.chatThreadId,
          content: this.newMessage
        });
        this.chatMessages.push(chatMessages[1]);

        this.newMessage = '';

        this.$nextTick(() => {
          if (this.$refs.messagesContainer) {
            this.$refs.messagesContainer.scrollTop = this.$refs.messagesContainer.scrollHeight;
          }
        });
      } finally {
        this.sendingMessage = false;
      }
    },
    selectThread(threadId) {
      this.$router.push('/chat/' + threadId);
    },
    styleForMessage(message) {
      return message.role === 'user' ? 'bg-gray-100' : '';
    },
    async createNewThread() {
      const { chatThread } = await api.ChatThread.createChatThread();
      this.$router.push('/chat/' + chatThread._id);
    }
  },
  async mounted() {
    this.chatThreadId = this.threadId;
    const { chatThreads } = await api.ChatThread.listChatThreads();
    this.chatThreads = chatThreads;
    if (this.chatThreadId) {
      const { chatMessages } = await api.ChatThread.getChatThread({ chatThreadId: this.chatThreadId });
      this.chatMessages = chatMessages;
    }
    this.status = 'loaded';

    if (this.chatThreadId) {
      // Scroll to bottom of messages container after messages are loaded
      this.$nextTick(() => {
        if (this.$refs.messagesContainer) {
          this.$refs.messagesContainer.scrollTop = this.$refs.messagesContainer.scrollHeight;
        }

        this.$refs.messagesContainer.querySelectorAll('code').forEach(el => {
          Prism.highlightElement(el);
        });
      });
    }
  }
});
