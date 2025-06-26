'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const mongoose = require('mongoose');

const ListChatThreadsParams = new Archetype({
  userId: {
    $type: mongoose.Types.ObjectId
  },
  roles: {
    $type: ['string']
  }
}).compile('ListChatThreadsParams');

module.exports = ({ db, studioConnection }) => async function listChatThreads(params) {
  // Validate the params object
  const { userId, roles } = new ListChatThreadsParams(params);
  const ChatThread = studioConnection.model('__Studio_ChatThread');

  await authorize('ChatThread.listChatThreads', roles);

  // Get all chat threads
  const chatThreads = await ChatThread.find(userId ? { userId } : {})
    .sort({ updatedAt: -1 }); // Sort by most recently updated

  return {
    chatThreads
  };
};
