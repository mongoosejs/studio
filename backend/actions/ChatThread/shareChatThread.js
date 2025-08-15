'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const mongoose = require('mongoose');

const ShareChatThreadParams = new Archetype({
  chatThreadId: {
    $type: mongoose.Types.ObjectId
  },
  share: {
    $type: 'boolean'
  },
  initiatedById: {
    $type: mongoose.Types.ObjectId
  },
  roles: {
    $type: ['string']
  },
  $workspaceId: {
    $type: mongoose.Types.ObjectId
  }
}).compile('ShareChatThreadParams');

module.exports = ({ studioConnection }) => async function shareChatThread(params) {
  const { chatThreadId, share, initiatedById, roles, $workspaceId } = new ShareChatThreadParams(params);
  const ChatThread = studioConnection.model('__Studio_ChatThread');

  await authorize('ChatThread.shareChatThread', roles);

  const chatThread = await ChatThread.findById(chatThreadId).orFail();
  if (!chatThread) {
    throw new Error('Chat thread not found');
  }
  console.log('G', initiatedById, chatThread);
  if (initiatedById != null && chatThread.userId?.toString() !== initiatedById.toString()) {
    throw new Error('Not authorized');
  }

  if (!$workspaceId || !chatThread.workspaceId || chatThread.workspaceId.toString() !== $workspaceId.toString()) {
    throw new Error('Workspace required to share');
  }

  chatThread.sharingOptions = chatThread.sharingOptions || {};
  chatThread.sharingOptions.sharedWithWorkspace = !!share;

  await chatThread.save();

  return { chatThread };
};
