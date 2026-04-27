'use strict';

const api = require('../api');
const agentToolMetadata = require('../../../backend/chatAgent/agentToolMetadata');
const getCurrentDateTimeContext = require('../getCurrentDateTimeContext');
const template = require('./chat.html');

const AGENT_MODE_STORAGE_KEY = '_mongooseStudioAgentMode';

module.exports = {
  template: template,
  props: ['threadId'],
  data: () => ({
    status: 'loading',
    sendingMessage: false,
    newMessage: '',
    chatThreadId: null,
    draftAgentMode: false,
    chatThreads: [],
    chatMessages: [],
    hideSidebar: null,
    showAgentSidebar: false,
    sharingThread: false,
    threadSearch: '',
    showProUpgradeModal: false,
    agentTools: agentToolMetadata
  }),
  methods: {
    async sendMessage() {
      this.sendingMessage = true;
      try {
        const content = this.newMessage;
        this.newMessage = '';
        if (!this.chatThreadId) {
          const { chatThread } = await api.ChatThread.createChatThread({
            agentMode: this.draftAgentMode
          });
          this.chatThreads.unshift(chatThread);
          this.chatThreadId = chatThread._id;
          this.chatMessages = [];
          this.$toast.success('Chat thread created!');
        }

        const userChatMessageIndex = this.chatMessages.length;
        this.chatMessages.push({
          _id: Math.random().toString(36).substr(2, 9),
          content,
          role: 'user'
        });

        this.scrollToBottom();

        const params = {
          chatThreadId: this.chatThreadId,
          content,
          currentDateTime: getCurrentDateTimeContext()
        };
        let userChatMessage = null;
        let assistantChatMessage = null;
        const toolCalls = [];
        for await (const event of api.ChatThread.streamChatMessage(params)) {
          if (event.chatMessage) {
            if (!userChatMessage) {
              userChatMessage = event.chatMessage;
              this.chatMessages.splice(userChatMessageIndex, 1, userChatMessage);
            } else {
              const assistantChatMessageIndex = this.chatMessages.indexOf(assistantChatMessage);
              assistantChatMessage = event.chatMessage;
              assistantChatMessage.toolCalls = toolCalls;
              if (assistantChatMessageIndex !== -1) {
                this.chatMessages.splice(assistantChatMessageIndex, 1, assistantChatMessage);
              } else {
                this.chatMessages.push(assistantChatMessage);
              }
            }
          } else if (event.chatThread) {
            for (const thread of this.chatThreads) {
              if (thread._id === event.chatThread._id) {
                thread.title = event.chatThread.title;
              }
            }
          } else if (event.toolCall) {
            toolCalls.push({ toolName: event.toolCall.toolName, input: event.toolCall.input, status: 'running' });
            if (!assistantChatMessage) {
              assistantChatMessage = {
                _id: Math.random().toString(36).substr(2, 9),
                content: '',
                role: 'assistant',
                toolCalls: [...toolCalls]
              };
              this.chatMessages.push(assistantChatMessage);
              assistantChatMessage = this.chatMessages[this.chatMessages.length - 1];
            } else {
              assistantChatMessage.toolCalls = [...toolCalls];
            }
            this.scrollToBottom();
          } else if (event.toolResult) {
            const tc = toolCalls.find(t => t.toolName === event.toolResult.toolName && t.status === 'running');
            if (tc) {
              tc.status = 'done';
            }
            if (assistantChatMessage) {
              assistantChatMessage.toolCalls = [...toolCalls];
            }
            this.scrollToBottom();
          } else if (event.textPart) {
            if (!assistantChatMessage) {
              assistantChatMessage = {
                _id: Math.random().toString(36).substr(2, 9),
                content: event.textPart,
                role: 'assistant',
                toolCalls: [...toolCalls]
              };
              this.chatMessages.push(assistantChatMessage);
              assistantChatMessage = this.chatMessages[this.chatMessages.length - 1];
              this.scrollToBottom();
            } else {
              assistantChatMessage.content += event.textPart;
              this.scrollToBottom();
            }
          } else if (event.message) {
            throw new Error(event.message);
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
      } catch (err) {
        this.$toast.error(err?.message || 'Failed to send message.');
      } finally {
        this.sendingMessage = false;
      }
    },
    async toggleAgentMode() {
      const wasEnabled = this.isAgentModeEnabled;
      const newValue = !this.isAgentModeEnabled;
      this.draftAgentMode = newValue;
      this.persistAgentModePreference(newValue);
      if (!this.chatThreadId) {
        this.maybeOpenAgentSidebar({ wasEnabled, isEnabled: newValue });
        return;
      }
      const { chatThread } = await api.ChatThread.toggleAgentMode({
        chatThreadId: this.chatThreadId,
        agentMode: newValue
      });
      const idx = this.chatThreads.findIndex(t => t._id === chatThread._id);
      if (idx !== -1) {
        this.chatThreads.splice(idx, 1, chatThread);
      }
      this.maybeOpenAgentSidebar({ wasEnabled, isEnabled: newValue });
    },
    scrollToBottom() {
      this.$nextTick(() => {
        if (this.$refs.messagesContainer) {
          this.$refs.messagesContainer.scrollTop = this.$refs.messagesContainer.scrollHeight;
        }
      });
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
      return message.role === 'user' ? 'bg-muted' : '';
    },
    async createNewThread() {
      const { chatThread } = await api.ChatThread.createChatThread({
        agentMode: this.draftAgentMode
      });
      this.$toast.success('Chat thread created!');
      this.$router.push('/chat/' + chatThread._id);
    },
    formatThreadDate(dateStr) {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now - date;
      const oneDay = 24 * 60 * 60 * 1000;
      const isToday = date.toDateString() === now.toDateString();
      const isYesterday = new Date(now - oneDay).toDateString() === date.toDateString();
      const timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      if (isToday) return 'Today, ' + timeStr;
      if (isYesterday) return 'Yesterday, ' + timeStr;
      if (diff < 7 * oneDay) {
        return date.toLocaleDateString(undefined, { weekday: 'long' }) + ', ' + timeStr;
      }
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' + timeStr;
    },
    async toggleShareThread() {
      if (!this.chatThreadId || !this.hasWorkspace) {
        throw new Error('Cannot share thread: chatThreadId or hasWorkspace is missing');
      }
      this.sharingThread = true;
      try {
        const share = true;
        const { chatThread } = await api.ChatThread.shareChatThread({ chatThreadId: this.chatThreadId, share });
        const idx = this.chatThreads.findIndex(t => t._id === chatThread._id);
        if (idx !== -1) {
          this.chatThreads.splice(idx, 1, chatThread);
        }

        this.$toast.success('Chat thread shared!');

        // Copy current URL to clipboard and show a toast
        const url = window.location.href;
        await navigator.clipboard.writeText(url);
        this.$toast.success('Share link copied!');
      } finally {
        this.sharingThread = false;
      }
    },
    isDesktopViewport() {
      return typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(min-width: 1024px)').matches;
    },
    getAgentModePreference() {
      if (typeof window === 'undefined') {
        return false;
      }
      return window.localStorage?.getItem(AGENT_MODE_STORAGE_KEY) === 'true';
    },
    persistAgentModePreference(agentMode) {
      if (typeof window !== 'undefined') {
        window.localStorage?.setItem(AGENT_MODE_STORAGE_KEY, String(agentMode));
      }
    },
    async syncCurrentThreadAgentMode() {
      if (!this.chatThreadId || !this.currentThread || !this.draftAgentMode || this.currentThread.agentMode) {
        return;
      }
      const { chatThread } = await api.ChatThread.toggleAgentMode({
        chatThreadId: this.chatThreadId,
        agentMode: true
      });
      const idx = this.chatThreads.findIndex(t => t._id === chatThread._id);
      if (idx !== -1) {
        this.chatThreads.splice(idx, 1, chatThread);
      }
    },
    maybeOpenAgentSidebar({ wasEnabled, isEnabled }) {
      if (!isEnabled) {
        this.showAgentSidebar = false;
        return;
      }
      if (wasEnabled || !this.isDesktopViewport()) {
        return;
      }
      this.showAgentSidebar = true;
    },
    closeAgentSidebar() {
      this.showAgentSidebar = false;
    }
  },
  computed: {
    currentThread() {
      return this.chatThreads.find(t => t._id === this.chatThreadId);
    },
    isAgentModeEnabled() {
      return this.currentThread?.agentMode ?? this.draftAgentMode;
    },
    hasWorkspace() {
      return !!window.MONGOOSE_STUDIO_CONFIG.workspace?._id;
    },
    sharedWithWorkspace() {
      return !!this.currentThread?.sharingOptions?.sharedWithWorkspace;
    },
    filteredThreads() {
      const search = this.threadSearch.trim().toLowerCase();
      if (!search) {
        return this.chatThreads;
      }
      return this.chatThreads.filter(t => (t.title || 'Untitled Thread').toLowerCase().includes(search));
    }
  },
  async mounted() {
    window.pageState = this;

    this.draftAgentMode = this.getAgentModePreference();
    this.chatThreadId = this.threadId;
    const { chatThreads } = await api.ChatThread.listChatThreads();
    this.chatThreads = chatThreads;
    if (this.chatThreadId) {
      await this.syncCurrentThreadAgentMode();
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

    this.$refs.messageInput.focus();
  }
};
