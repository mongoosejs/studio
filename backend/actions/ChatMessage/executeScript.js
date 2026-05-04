'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const createSandbox = require('../../sandbox/createSandbox');
const mongoose = require('mongoose');

const ExecuteScriptParams = new Archetype({
  initiatedById: {
    $type: mongoose.Types.ObjectId
  },
  chatMessageId: {
    $type: mongoose.Types.ObjectId,
    $required: true
  },
  script: {
    $type: 'string'
  },
  dryRun: {
    $type: 'boolean'
  },
  roles: {
    $type: ['string']
  }
}).compile('ExecuteScriptParams');

module.exports = ({ db, studioConnection }) => async function executeScript(params) {
  const { initiatedById, chatMessageId, script, dryRun, roles } = new ExecuteScriptParams(params);
  const ChatThread = studioConnection.model('__Studio_ChatThread');
  const ChatMessage = studioConnection.model('__Studio_ChatMessage');

  await authorize('ChatMessage.executeScript', roles);

  const chatMessage = await ChatMessage.findById(chatMessageId);
  if (!chatMessage) {
    throw new Error('Chat message not found');
  }
  const chatThread = await ChatThread.findById(chatMessage.chatThreadId).orFail();

  if (initiatedById && chatThread.userId?.toString() !== initiatedById.toString()) {
    throw new Error('Unauthorized');
  }

  const sandbox = createSandbox({ db });

  let output;
  let error;

  try {
    // Execute the script in the sandbox
    output = await sandbox.runScript({ script, dryRun });

    const updatedContent = updateContentWithScript(chatMessage.content, chatMessage.script, script);
    chatMessage.script = script;
    chatMessage.content = updatedContent;
    chatMessage.executionResult = { output, logs: sandbox.getLogs(), error: null, dryRun: !!dryRun };
    await chatMessage.save();

    return { chatMessage };
  } catch (err) {
    error = err.message;

    // Update the chat message with the error
    const updatedContent = updateContentWithScript(chatMessage.content, chatMessage.script, script);
    await ChatMessage.updateOne(
      { _id: chatMessageId },
      {
        script,
        content: updatedContent,
        executionResult: {
          output: null,
          logs: sandbox.getLogs(),
          error,
          dryRun: !!dryRun
        }
      }
    );

    throw new Error(`Script execution failed: ${error}`);
  } finally {
    await sandbox.close();
  }
};

function updateContentWithScript(content, previousScript, newScript) {
  if (typeof content !== 'string') {
    return content;
  }

  const matches = Array.from(content.matchAll(/```(\w*)\n([\s\S]*?)\n```/g));
  let targetMatch = null;

  if (matches.length > 0) {
    if (previousScript != null) {
      const trimmedPrevious = previousScript.trim();
      targetMatch = matches.find(match => match[2].trim() === trimmedPrevious) || null;
    }

    if (targetMatch == null) {
      targetMatch = matches[0];
    }
  }

  if (targetMatch != null) {
    const language = targetMatch[1];
    const fenceStart = language ? '```' + language : '```';
    const replacement = fenceStart + '\n' + newScript + '\n```';
    return (
      content.slice(0, targetMatch.index) +
      replacement +
      content.slice(targetMatch.index + targetMatch[0].length)
    );
  }

  const trimmedContent = content.trimEnd();
  const prefix = trimmedContent.length > 0 ? trimmedContent + '\n\n' : '';

  return prefix + '```\n' + newScript + '\n```';
}
