'use strict';

const assert = require('assert');
const baseApp = require('./setup');
const { createSSRApp } = require('vue');
const { renderToString } = require('vue/server-renderer');
const sinon = require('sinon');

const api = require('../../frontend/src/api');
const chat = require('../../frontend/src/chat/chat');
const baseComponent = require('../../frontend/src/_util/baseComponent');

describe('chat component', function() {
  afterEach(function() {
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
});
