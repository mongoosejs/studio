'use strict';

const Archetype = require('archetype');
const mongoose = require('mongoose');

const GetChatThreadParams = new Archetype({
  chatThreadId: {
    $type: mongoose.Types.ObjectId
  },
  userId: {
    $type: mongoose.Types.ObjectId
  }
}).compile('GetChatThreadParams');

module.exports = ({ db, studioConnection }) => async function getChatThread(params) {
  const { chatThreadId, userId } = new GetChatThreadParams(params);
  const ChatThread = studioConnection.model('__Studio_ChatThread');
  const ChatMessage = studioConnection.model('__Studio_ChatMessage');

  const chatThread = await ChatThread.findById(chatThreadId);

  if (!chatThread) {
    throw new Error('Chat thread not found');
  }
  if (userId && chatThread.userId?.toString() !== userId.toString()) {
    throw new Error('Not authorized');
  }

  const chatMessages = await ChatMessage.find({ chatThreadId })
    .sort({ createdAt: -1 });

  return {
    chatThread,
    chatMessages: chatMessages.reverse() // Return in chronological order
  };
};
