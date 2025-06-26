'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const mongoose = require('mongoose');

const CreateChatThreadParams = new Archetype({
  userId: {
    $type: mongoose.Types.ObjectId
  },
  roles: {
    $type: ['string'],
  }
}).compile('CreateChatThreadParams');

module.exports = ({ studioConnection }) => async function createChatThread(params) {
  const { userId } = new CreateChatThreadParams(params);
  const ChatThread = studioConnection.model('__Studio_ChatThread');

  await authorize('ChatThread.createChatThread', roles);

  const chatThread = await ChatThread.create({ userId });

  return { chatThread };
};
