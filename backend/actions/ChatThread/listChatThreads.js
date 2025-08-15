'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const mongoose = require('mongoose');

const ListChatThreadsParams = new Archetype({
  initiatedById: {
    $type: mongoose.Types.ObjectId
  },
  roles: {
    $type: ['string']
  }
}).compile('ListChatThreadsParams');

module.exports = ({ db, studioConnection }) => async function listChatThreads(params) {
  // Validate the params object
  const { initiatedById, roles } = new ListChatThreadsParams(params);
  const ChatThread = studioConnection.model('__Studio_ChatThread');

  await authorize('ChatThread.listChatThreads', roles);

  const query = { userId: initiatedById };

  // Get all chat threads
  const chatThreads = await ChatThread.find(query)
    .sort({ updatedAt: -1 }); // Sort by most recently updated

  return {
    chatThreads
  };
};
