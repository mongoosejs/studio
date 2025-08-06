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
  },
  $workspaceId: {
    $type: mongoose.Types.ObjectId
  }
}).compile('ListChatThreadsParams');

module.exports = ({ db, studioConnection }) => async function listChatThreads(params) {
  // Validate the params object
  const { userId, roles, $workspaceId } = new ListChatThreadsParams(params);
  const ChatThread = studioConnection.model('__Studio_ChatThread');

  await authorize('ChatThread.listChatThreads', roles);

  const query = { $or: [{ userId }] };
  if ($workspaceId) {
    query.$or.push({ workspaceId: $workspaceId, 'sharingOptions.sharedWithWorkspace': true });
  }

  // Get all chat threads
  const chatThreads = await ChatThread.find(query)
    .sort({ updatedAt: -1 }); // Sort by most recently updated

  return {
    chatThreads
  };
};
