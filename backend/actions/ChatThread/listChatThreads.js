'use strict';

const Archetype = require('archetype');
const mongoose = require('mongoose');

const ListChatThreadsParams = new Archetype({
  userId: {
    $type: mongoose.Types.ObjectId
  }
}).compile('ListChatThreadsParams');

module.exports = ({ db, studioConnection }) => async function listChatThreads(params) {
  // Just validate the params object, but no actual parameters needed
  const { userId } = new ListChatThreadsParams(params);
  const ChatThread = studioConnection.model('__Studio_ChatThread');

  // Get all chat threads
  const chatThreads = await ChatThread.find(userId ? { userId } : {})
    .sort({ updatedAt: -1 }); // Sort by most recently updated

  return {
    chatThreads
  };
};
