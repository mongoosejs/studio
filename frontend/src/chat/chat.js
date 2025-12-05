'use strict';

const api = require('../api');
const template = require('./chat.html');
const vanillatoasts = require('vanillatoasts');

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
    hideSidebar: null,
    sharingThread: false
  }),
  methods: {
    async sendMessage() {
      this.sendingMessage = true;
      try {
        const content = this.newMessage;
        this.newMessage = '';
        if (!this.chatThreadId) {
          const { chatThread } = await api.ChatThread.createChatThread();
          this.chatThreads.unshift(chatThread);
          this.chatThreadId = chatThread._id;
          this.chatMessages = [];
        }

        this.chatMessages.push({
          content,
          role: 'user'
        });

        this.$nextTick(() => {
          if (this.$refs.messagesContainer) {
            this.$refs.messagesContainer.scrollTop = this.$refs.messagesContainer.scrollHeight;
          }
        });

        const params = { chatThreadId: this.chatThreadId, content };
        let userChatMessage = null;
        let assistantChatMessage = null;
        for await (const event of api.ChatThread.streamChatMessage(params)) {
          if (event.chatMessage) {
            if (!userChatMessage) {
              userChatMessage = event.chatMessage;
            } else {
              const assistantChatMessageIndex = this.chatMessages.indexOf(assistantChatMessage);
              assistantChatMessage = event.chatMessage;
              this.chatMessages[assistantChatMessageIndex] = assistantChatMessage;
            }
          } else if (event.chatThread) {
            for (const thread of this.chatThreads) {
              if (thread._id === event.chatThread._id) {
                thread.title = event.chatThread.title;
              }
            }
          } else if (event.textPart) {
            if (!assistantChatMessage) {
              assistantChatMessage = {
                content: event.textPart,
                role: 'assistant'
              };
              this.chatMessages.push(assistantChatMessage);
              assistantChatMessage = this.chatMessages[this.chatMessages.length - 1];
              this.$nextTick(() => {
                if (this.$refs.messagesContainer) {
                  this.$refs.messagesContainer.scrollTop = this.$refs.messagesContainer.scrollHeight;
                }
              });
            } else {
              assistantChatMessage.content += event.textPart;
              this.$nextTick(() => {
                if (this.$refs.messagesContainer) {
                  this.$refs.messagesContainer.scrollTop = this.$refs.messagesContainer.scrollHeight;
                }
              });
            }
          }
        }

        this.newMessage = '';
        this.$nextTick(() => {
          if (this.$refs.messageInput) {
            this.$refs.messageInput.style.height = 'auto';
          }
        });

        this.$nextTick(() => {
          if (this.$refs.messagesContainer) {
            this.$refs.messagesContainer.scrollTop = this.$refs.messagesContainer.scrollHeight;
          }
        });
      } finally {
        this.sendingMessage = false;
      }
    },
    handleEnter(ev) {
      if (!ev.shiftKey) {
        this.sendMessage();
      }
    },
    adjustTextareaHeight(ev) {
      const textarea = ev.target;
      textarea.style.height = 'auto';
      const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight, 10);
      const maxHeight = lineHeight * 5;
      textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
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
    },
    async toggleShareThread() {
      if (!this.chatThreadId || !this.hasWorkspace) {
        return;
      }
      this.sharingThread = true;
      try {
        const share = true;
        const { chatThread } = await api.ChatThread.shareChatThread({ chatThreadId: this.chatThreadId, share });
        const idx = this.chatThreads.findIndex(t => t._id === chatThread._id);
        if (idx !== -1) {
          this.chatThreads.splice(idx, 1, chatThread);
        }

        // Copy current URL to clipboard and show a toast
        const url = window.location.href;
        await navigator.clipboard.writeText(url);
        vanillatoasts.create({
          title: 'Share link copied!',
          type: 'success',
          timeout: 3000,
          icon: 'images/success.png',
          positionClass: 'bottomRight'
        });
      } finally {
        this.sharingThread = false;
      }
    }
  },
  computed: {
    currentThread() {
      return this.chatThreads.find(t => t._id === this.chatThreadId);
    },
    hasWorkspace() {
      return !!window.MONGOOSE_STUDIO_CONFIG.workspace?._id;
    },
    sharedWithWorkspace() {
      return !!this.currentThread?.sharingOptions?.sharedWithWorkspace;
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
