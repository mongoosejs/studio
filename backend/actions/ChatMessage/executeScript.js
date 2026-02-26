'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const mongoose = require('mongoose');
const vm = require('vm');

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
  roles: {
    $type: ['string']
  }
}).compile('ExecuteScriptParams');

module.exports = ({ db, studioConnection }) => async function executeScript(params) {
  const { initiatedById, chatMessageId, script, roles } = new ExecuteScriptParams(params);
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

  // Create a sandbox with the db object
  const logs = [];
  if (!db.Types) {
    db.Types = mongoose.Types;
  }
  const sandbox = { db, mongoose, console: {}, ObjectId: mongoose.Types.ObjectId };

  // Capture console logs
  sandbox.console.log = function() {
    const args = Array.from(arguments);
    logs.push(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '));
  };

  const context = vm.createContext(sandbox);

  let output;
  let error;

  try {
    // Execute the script in the sandbox
    output = await vm.runInContext(wrappedScript(script), context);

    const updatedContent = updateContentWithScript(chatMessage.content, chatMessage.script, script);
    chatMessage.script = script;
    chatMessage.content = updatedContent;
    chatMessage.executionResult = { output, logs: logs.join('\n'), error: null };
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
          logs: logs.join('\n'),
          error
        }
      }
    );

    throw new Error(`Script execution failed: ${error}`);
  }
};

const wrappedScript = script => `(async () => {
  ${script}
})()`;

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
