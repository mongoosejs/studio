'use strict';

const Archetype = require('archetype');
const mongoose = require('mongoose');
const vm = require('vm');

const ExecuteScriptParams = new Archetype({
  userId: {
    $type: mongoose.Types.ObjectId
  },
  chatMessageId: {
    $type: mongoose.Types.ObjectId
  },
  script: {
    $type: String
  }
}).compile('ExecuteScriptParams');

module.exports = ({ db }) => async function executeScript(params) {
  const { userId, chatMessageId, script } = new ExecuteScriptParams(params);
  const ChatMessage = db.model('__Studio_ChatMessage');

  const chatMessage = await ChatMessage.findById(chatMessageId);
  if (!chatMessage) {
    throw new Error('Chat message not found');
  }

  // Create a sandbox with the db object
  const logs = [];
  const sandbox = { db, console: {} };

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

    chatMessage.script = script;
    chatMessage.executionResult = { output, logs: logs.join('\n'), error: null };
    await chatMessage.save();

    return { chatMessage };
  } catch (err) {
    error = err.message;

    // Update the chat message with the error
    await ChatMessage.updateOne(
      { _id: chatMessageId },
      {
        script,
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
