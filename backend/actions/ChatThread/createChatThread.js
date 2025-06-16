'use strict';

const Archetype = require('archetype');
const mongoose = require('mongoose');

const CreateChatThreadParams = new Archetype({
  userId: {
    $type: mongoose.Types.ObjectId
  }
}).compile('CreateChatThreadParams');

module.exports = ({ studioConnection }) => async function createChatThread(params) {
  const { userId } = new CreateChatThreadParams(params);
  const ChatThread = studioConnection.model('__Studio_ChatThread');

  const chatThread = await ChatThread.create({ userId });

  return { chatThread };
};
