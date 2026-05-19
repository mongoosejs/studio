'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const mongoose = require('mongoose');

const ToggleAgentModeParams = new Archetype({
  chatThreadId: {
    $type: mongoose.Types.ObjectId
  },
  agentMode: {
    $type: 'boolean'
  },
  initiatedById: {
    $type: mongoose.Types.ObjectId
  },
  roles: {
    $type: ['string']
  }
}).compile('ToggleAgentModeParams');

module.exports = ({ studioConnection }) => async function toggleAgentMode(params) {
  const { chatThreadId, agentMode, initiatedById, roles } = new ToggleAgentModeParams(params);
  const ChatThread = studioConnection.model('__Studio_ChatThread');

  await authorize('ChatThread.toggleAgentMode', roles);

  const chatThread = await ChatThread.findById(chatThreadId).orFail();
  if (initiatedById != null && chatThread.userId?.toString() !== initiatedById.toString()) {
    throw new Error('Not authorized');
  }

  chatThread.agentMode = agentMode;
  await chatThread.save();

  return { chatThread };
};
