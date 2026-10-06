'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const mongoose = require('mongoose');
const operationOptions = require('../../helpers/operationOptions');

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
  },
  maxTimeMS: {
    $type: 'number'
  }
}).compile('ToggleAgentModeParams');

module.exports = ({ studioConnection, options }) => async function toggleAgentMode(params) {
  const { chatThreadId, agentMode, initiatedById, roles } = new ToggleAgentModeParams(params);
  const ChatThread = studioConnection.model('__Studio_ChatThread');

  await authorize('ChatThread.toggleAgentMode', roles);

  const chatThread = await ChatThread.findById(chatThreadId).
    setOptions(operationOptions(options, params)).
    orFail();
  if (initiatedById != null && chatThread.userId?.toString() !== initiatedById.toString()) {
    throw new Error('Not authorized');
  }

  chatThread.agentMode = agentMode;
  await chatThread.save();

  return { chatThread };
};
