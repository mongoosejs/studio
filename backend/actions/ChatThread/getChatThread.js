'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const mongoose = require('mongoose');
const operationOptions = require('../../helpers/operationOptions');

const GetChatThreadParams = new Archetype({
  chatThreadId: {
    $type: mongoose.Types.ObjectId
  },
  initiatedById: {
    $type: mongoose.Types.ObjectId
  },
  roles: {
    $type: ['string']
  },
  $workspaceId: {
    $type: mongoose.Types.ObjectId
  },
  maxTimeMS: {
    $type: 'number'
  }
}).compile('GetChatThreadParams');

module.exports = ({ db, studioConnection, options }) => async function getChatThread(params) {
  const { chatThreadId, initiatedById, roles, $workspaceId } = new GetChatThreadParams(params);
  const ChatThread = studioConnection.model('__Studio_ChatThread');
  const ChatMessage = studioConnection.model('__Studio_ChatMessage');

  await authorize('ChatThread.getChatThread', roles);

  const dbOptions = operationOptions(options, params);
  const chatThread = await ChatThread.findById(chatThreadId).setOptions(dbOptions);

  if (!chatThread) {
    throw new Error('Chat thread not found');
  }
  if (initiatedById && chatThread.userId?.toString() !== initiatedById.toString()) {
    
    if (!$workspaceId || chatThread.workspaceId?.toString() !== $workspaceId.toString() || !chatThread.sharingOptions?.sharedWithWorkspace) {
      throw new Error('Not authorized');
    }
  }

  const chatMessages = await ChatMessage.find({ chatThreadId })
    .setOptions(dbOptions)
    .sort({ createdAt: -1 });

  return {
    chatThread,
    chatMessages: chatMessages.reverse() // Return in chronological order
  };
};
