'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const mongoose = require('mongoose');

const CreateChatThreadParams = new Archetype({
  initiatedById: {
    $type: mongoose.Types.ObjectId
  },
  roles: {
    $type: ['string']
  },
  $workspaceId: {
    $type: mongoose.Types.ObjectId,
    $required: false
  },
  initialMessage: {
    $type: 'string',
    $required: false
  },
  dashboardId: {
    $type: mongoose.Types.ObjectId,
    $required: false
  }
}).compile('CreateChatThreadParams');

module.exports = ({ studioConnection }) => async function createChatThread(params) {
  const { initiatedById, roles, $workspaceId, initialMessage, dashboardId } = new CreateChatThreadParams(params);
  const ChatThread = studioConnection.model('__Studio_ChatThread');
  const ChatMessage = studioConnection.model('__Studio_ChatMessage');

  await authorize('ChatThread.createChatThread', roles);

  const doc = { userId: initiatedById };
  if ($workspaceId) {
    doc.workspaceId = $workspaceId;
  }
  if ($workspaceId && !initiatedById) {
    throw new Error('initiatedById is required when creating a chat thread in a workspace');
  }
  if (dashboardId) {
    doc.dashboardId = dashboardId;
  }
  const chatThread = await ChatThread.create(doc);

  if (initialMessage != null && initialMessage.trim() !== '') {
    await ChatMessage.create({
      chatThreadId: chatThread._id,
      role: 'user',
      content: initialMessage.trim(),
      script: null,
      executionResult: null
    });
  }

  return { chatThread };
};
