'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
const { actions } = require('./setup.test');

describe('ChatThread.shareChatThread', function() {
  it('shares and unshares chat thread with workspace', async function() {
    const userId = new mongoose.Types.ObjectId();
    const workspaceId = new mongoose.Types.ObjectId();

    let { chatThread } = await actions.ChatThread.createChatThread({ userId, roles: ['member'], $workspaceId: workspaceId });
    assert.equal(chatThread.workspaceId.toString(), workspaceId.toString());
    assert.ok(!chatThread.sharingOptions?.sharedWithWorkspace);

    ({ chatThread } = await actions.ChatThread.shareChatThread({
      chatThreadId: chatThread._id,
      share: true,
      userId,
      roles: ['member'],
      $workspaceId: workspaceId
    }));
    assert.ok(chatThread.sharingOptions.sharedWithWorkspace);

    const otherUser = new mongoose.Types.ObjectId();
    const { chatThreads } = await actions.ChatThread.listChatThreads({
      userId: otherUser,
      roles: ['member'],
      $workspaceId: workspaceId
    });
    assert.equal(chatThreads.length, 1);
    assert.equal(chatThreads[0]._id.toString(), chatThread._id.toString());

    const res = await actions.ChatThread.getChatThread({
      chatThreadId: chatThread._id,
      userId: otherUser,
      roles: ['member'],
      $workspaceId: workspaceId
    });
    assert.equal(res.chatThread._id.toString(), chatThread._id.toString());
    assert.ok(res.chatThread.sharingOptions.sharedWithWorkspace);

    ({ chatThread } = await actions.ChatThread.shareChatThread({
      chatThreadId: chatThread._id,
      share: false,
      userId,
      roles: ['member'],
      $workspaceId: workspaceId
    }));
    assert.ok(!chatThread.sharingOptions.sharedWithWorkspace);
  });
});
