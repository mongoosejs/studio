'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const getModelDescriptions = require('../../helpers/getModelDescriptions');
const mongoose = require('mongoose');

const CreateChatMessageParams = new Archetype({
  chatThreadId: {
    $type: mongoose.Types.ObjectId
  },
  initiatedById: {
    $type: mongoose.Types.ObjectId
  },
  content: {
    $type: String
  },
  authorization: {
    $type: 'string'
  },
  roles: {
    $type: ['string']
  }
}).compile('CreateChatMessageParams');

module.exports = ({ db, studioConnection, options }) => async function createChatMessage(params) {
  const { chatThreadId, initiatedById, content, script, authorization, roles } = new CreateChatMessageParams(params);
  const ChatThread = studioConnection.model('__Studio_ChatThread');
  const ChatMessage = studioConnection.model('__Studio_ChatMessage');

  await authorize('ChatThread.createChatMessage', roles);

  // Check that the user owns the thread
  const chatThread = await ChatThread.findOne({ _id: chatThreadId });
  if (!chatThread) {
    throw new Error('Chat thread not found');
  }
  if (initiatedById != null && chatThread.userId.toString() !== initiatedById.toString()) {
    throw new Error('Not authorized');
  }

  const messages = await ChatMessage.find({ chatThreadId }).sort({ createdAt: 1 });
  const llmMessages = messages.map(m => ({
    role: m.role,
    content: m.content
  }));
  llmMessages.push({ role: 'user', content });

  let summarizePromise = Promise.resolve();
  if (chatThread.title == null) {
    summarizePromise = summarizeChatThread(llmMessages, authorization).then(res => {
      const title = res.response;
      chatThread.title = title;
      return chatThread.save();
    });
  }

  if (options.context) {
    llmMessages.unshift({
      role: 'system',
      content: options.context
    });
  }

  const modelDescriptions = getModelDescriptions(db);

  // Create the chat message and get OpenAI response in parallel
  const chatMessages = await Promise.all([
    ChatMessage.create({
      chatThreadId,
      role: 'user',
      content,
      script,
      executionResult: null
    }),
    createChatMessageCore(llmMessages, modelDescriptions, options?.model, authorization).then(res => {
      const content = res.response;
      return ChatMessage.create({
        chatThreadId,
        role: 'assistant',
        content
      });
    })
  ]);

  await summarizePromise;
  return { chatMessages, chatThread };
};

async function summarizeChatThread(messages, authorization) {
  const headers = { 'Content-Type': 'application/json' };
  if (authorization) {
    headers.Authorization = authorization;
  }
  const response = await fetch('https://mongoose-js.netlify.app/.netlify/functions/summarizeChatThread', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages
    })
  }).then(response => {
    if (response.status < 200 || response.status >= 400) {
      return response.json().then(data => {
        throw new Error(`Mongoose Studio chat thread summarization error: ${data.message}`);
      });
    }
    return response;
  });

  return await response.json();
}

async function createChatMessageCore(messages, modelDescriptions, model, authorization) {
  const headers = { 'Content-Type': 'application/json' };
  if (authorization) {
    headers.Authorization = authorization;
  }
  const response = await fetch('https://mongoose-js.netlify.app/.netlify/functions/createChatMessage', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages,
      modelDescriptions,
      model
    })
  }).then(response => {
    if (response.status < 200 || response.status >= 400) {
      return response.json().then(data => {
        throw new Error(`Mongoose Studio chat completion error: ${data.message}`);
      });
    }
    return response;
  });

  return await response.json();
}
