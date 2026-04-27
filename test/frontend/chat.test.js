'use strict';

const assert = require('assert');
const baseApp = require('./setup');
const { createSSRApp } = require('vue');
const { renderToString } = require('vue/server-renderer');
const sinon = require('sinon');

const api = require('../../frontend/src/api');
const chat = require('../../frontend/src/chat/chat');
const baseComponent = require('../../frontend/src/_util/baseComponent');
const time = require('time-commando');

describe('chat component', function() {
  afterEach(function() {
    delete window.matchMedia;
    window.localStorage.getItem = () => null;
    window.localStorage.setItem = () => {};
    sinon.restore();
  });

  it('handles chatMessage yielded before textPart events', async function() {
    const chatThreadId = '1'.repeat(24);
    const userMessageId = '2'.repeat(24);
    const assistantMessageId = '3'.repeat(24);

    sinon.stub(api.ChatThread, 'listChatThreads').callsFake(() => Promise.resolve({
      chatThreads: [{ _id: chatThreadId, title: 'Test Thread' }]
    }));

    sinon.stub(api.ChatThread, 'getChatThread').callsFake(() => Promise.resolve({
      chatMessages: []
    }));

    sinon.stub(api.ChatThread, 'createChatThread').callsFake(() => Promise.resolve({
      chatThread: { _id: chatThreadId, title: 'New Thread' }
    }));

    // Simulate streaming where chatMessage for assistant is yielded before textPart
    sinon.stub(api.ChatThread, 'streamChatMessage').callsFake(async function* () {
      // First yield user chatMessage
      yield {
        chatMessage: {
          _id: userMessageId,
          content: 'Hello',
          role: 'user'
        }
      };
      // Yield assistant chatMessage before any textPart
      yield {
        chatMessage: {
          _id: assistantMessageId,
          content: '',
          role: 'assistant'
        }
      };
      // Then yield textPart events
      yield { textPart: 'Hello' };
      yield { textPart: ' there!' };
      // Final chatMessage with complete content
      yield {
        chatMessage: {
          _id: assistantMessageId,
          content: 'Hello there!',
          role: 'assistant'
        }
      };
    });

    const chatWithBase = { ...chat, extends: baseComponent };
    const app = createSSRApp({
      template: `<chat :threadId="'${chatThreadId}'" />`,
      extends: baseApp
    });
    app.component('chat', chatWithBase);
    app.component('async-button', { template: '<div></div>' });
    app.component('chat-message', { template: '<div></div>' });
    app.config.globalProperties.$toast = { success: () => {}, error: () => {} };

    await renderToString(app);
    const instance = appInstance.$options.$children[0];

    // Wait for mounted to complete
    await instance.$nextTick();

    // Simulate sending a message
    instance.newMessage = 'Hello';
    await instance.sendMessage();

    // Verify that chatMessages array has correct structure
    // Should have user message and assistant message (no duplicates)
    // When chatMessage for assistant is yielded before textPart, subsequent chatMessages
    // with same role should update existing entry rather than push new ones
    assert.strictEqual(instance.chatMessages.length, 2, `Expected 2 messages but got ${instance.chatMessages.length}: ${JSON.stringify(instance.chatMessages)}`);
    assert.strictEqual(instance.chatMessages[0].role, 'user');
    assert.strictEqual(instance.chatMessages[1].role, 'assistant');
    assert.strictEqual(instance.chatMessages[1].content, 'Hello there!');
  });

  it('handles textPart events before chatMessage', async function() {
    const chatThreadId = '1'.repeat(24);
    const userMessageId = '2'.repeat(24);
    const assistantMessageId = '3'.repeat(24);

    sinon.stub(api.ChatThread, 'listChatThreads').callsFake(() => Promise.resolve({
      chatThreads: [{ _id: chatThreadId, title: 'Test Thread' }]
    }));

    sinon.stub(api.ChatThread, 'getChatThread').callsFake(() => Promise.resolve({
      chatMessages: []
    }));

    sinon.stub(api.ChatThread, 'createChatThread').callsFake(() => Promise.resolve({
      chatThread: { _id: chatThreadId, title: 'New Thread' }
    }));

    // Simulate streaming where textPart comes before assistant chatMessage
    sinon.stub(api.ChatThread, 'streamChatMessage').callsFake(async function* () {
      // First yield user chatMessage
      yield {
        chatMessage: {
          _id: userMessageId,
          content: 'Hello',
          role: 'user'
        }
      };
      // Yield textPart events first (no assistant chatMessage yet)
      yield { textPart: 'Hi' };
      yield { textPart: ' there!' };
      // Then yield assistant chatMessage
      yield {
        chatMessage: {
          _id: assistantMessageId,
          content: 'Hi there!',
          role: 'assistant'
        }
      };
    });

    const chatWithBase = { ...chat, extends: baseComponent };
    const app = createSSRApp({
      template: `<chat :threadId="'${chatThreadId}'" />`,
      extends: baseApp
    });
    app.component('chat', chatWithBase);
    app.component('async-button', { template: '<div></div>' });
    app.component('chat-message', { template: '<div></div>' });
    app.config.globalProperties.$toast = { success: () => {}, error: () => {} };

    await renderToString(app);
    const instance = appInstance.$options.$children[0];

    await instance.$nextTick();

    instance.newMessage = 'Hello';
    await instance.sendMessage();

    assert.strictEqual(instance.chatMessages.length, 2, `Expected 2 messages but got ${instance.chatMessages.length}: ${JSON.stringify(instance.chatMessages)}`);
    assert.strictEqual(instance.chatMessages[0].role, 'user');
    assert.strictEqual(instance.chatMessages[1].role, 'assistant');
    assert.strictEqual(instance.chatMessages[1].content, 'Hi there!');
  });

  it('passes the user current date time when streaming a chat message', async function() {
    sinon.stub(time, 'now').returns(new Date(2026, 2, 22, 15, 4, 5));
    const streamStub = sinon.stub(api.ChatThread, 'streamChatMessage').callsFake(async function* () {
      yield {
        chatMessage: {
          _id: '2'.repeat(24),
          content: 'Hello',
          role: 'user'
        }
      };
    });

    const state = {
      sendingMessage: false,
      newMessage: 'Hello',
      chatThreadId: '1'.repeat(24),
      chatMessages: [],
      chatThreads: [],
      $refs: {},
      $toast: { success: () => {} },
      $nextTick: fn => fn && fn(),
      scrollToBottom: () => {}
    };

    await chat.methods.sendMessage.call(state);

    const params = streamStub.firstCall.args[0];
    assert.strictEqual(params.currentDateTime, '2026-03-22T15:04:05');
  });

  it('surfaces a streamed error message', async function() {
    const toast = { success: () => {}, error: sinon.spy() };
    sinon.stub(api.ChatThread, 'streamChatMessage').callsFake(async function* () {
      yield { message: 'LLM stream failed' };
    });

    const state = {
      sendingMessage: false,
      newMessage: 'Hello',
      chatThreadId: '1'.repeat(24),
      chatMessages: [],
      chatThreads: [],
      $refs: {},
      $toast: toast,
      $nextTick: fn => fn && fn(),
      scrollToBottom: () => {}
    };

    await chat.methods.sendMessage.call(state);

    assert.ok(toast.error.calledOnceWithExactly('LLM stream failed'));
    assert.strictEqual(state.sendingMessage, false);
  });

  it('opens the agent sidebar when agent mode is enabled on desktop', async function() {
    window.matchMedia = sinon.stub().returns({ matches: true });
    const setItem = sinon.spy();
    window.localStorage.setItem = setItem;

    const state = {
      chatThreadId: null,
      draftAgentMode: false,
      showAgentSidebar: false,
      isAgentModeEnabled: false,
      isDesktopViewport: chat.methods.isDesktopViewport,
      persistAgentModePreference: chat.methods.persistAgentModePreference,
      maybeOpenAgentSidebar: chat.methods.maybeOpenAgentSidebar
    };

    await chat.methods.toggleAgentMode.call(state);

    assert.strictEqual(state.draftAgentMode, true);
    assert.strictEqual(state.showAgentSidebar, true);
    assert.ok(setItem.calledOnceWithExactly('_mongooseStudioAgentMode', 'true'));
  });

  it('turns agent mode on for a thread when the sticky preference is on', async function() {
    const toggledThread = { _id: '1'.repeat(24), agentMode: true };
    const toggleStub = sinon.stub(api.ChatThread, 'toggleAgentMode').resolves({ chatThread: toggledThread });

    const state = {
      chatThreadId: toggledThread._id,
      draftAgentMode: true,
      chatThreads: [{ _id: toggledThread._id, agentMode: false }],
      currentThread: { _id: toggledThread._id, agentMode: false }
    };

    await chat.methods.syncCurrentThreadAgentMode.call(state);

    assert.ok(toggleStub.calledOnceWithExactly({
      chatThreadId: toggledThread._id,
      agentMode: true
    }));
    assert.strictEqual(state.chatThreads[0].agentMode, true);
  });
});
