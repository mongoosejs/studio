'use strict';

const Archetype = require('archetype');
const getModelDescriptions = require('../../helpers/getModelDescriptions');
const mongoose = require('mongoose');

const CreateChatMessageParams = new Archetype({
  chatThreadId: {
    $type: mongoose.Types.ObjectId
  },
  userId: {
    $type: mongoose.Types.ObjectId
  },
  content: {
    $type: String
  },
  authorization: {
    $type: 'string',
    $required: true
  },
  roles: {
    $type: ['string'],
  }
}).compile('CreateChatMessageParams');

const systemPrompt = `
You are a data querying assistant who writes scripts for users accessing MongoDB data using Node.js and Mongoose.

Keep scripts concise. Avoid unnecessary comments, error handling, and temporary variables.

Do not write any imports or require() statements, that will cause the script to break.

If the user approves the script, the script will run in the Node.js server and then send the response via JSON to the client. Be aware that the result of the query will be serialized to JSON before being displayed to the user.

Assume the user has pre-defined schemas and models. Do not define any new schemas or models for the user.

Use async/await where possible. Assume top-level await is allowed.

Think carefully about the user's input and identify the models referred to by the user's query.

Format output as Markdown, including code fences for any scripts the user requested.

Add a brief text description of what the script does.

If the user's query is best answered with a chart, return a Chart.js 4 configuration as \`return { $chart: chartJSConfig };\`. Disable ChartJS animation by default unless user asks for it. Set responsive: true, maintainAspectRatio: false options unless the user explicitly asks.

Example output:

The following script counts the number of users which are not deleted.

\`\`\`javascript
const users = await db.model('User').find({ isDeleted: false });
return { numUsers: users.length };
\`\`\`

-----------

Here is a description of the user's models. Assume these are the only models available in the system unless explicitly instructed otherwise by the user.
`.trim();

module.exports = ({ db, studioConnection, options }) => async function createChatMessage(params) {
  const { chatThreadId, userId, content, script, authorization, roles } = new CreateChatMessageParams(params);
  const ChatThread = studioConnection.model('__Studio_ChatThread');
  const ChatMessage = studioConnection.model('__Studio_ChatMessage');

  if (roles && roles.includes('readonly')) {
    throw new Error('Not authorized');
  }

  // Check that the user owns the thread
  const chatThread = await ChatThread.findOne({ _id: chatThreadId });
  if (!chatThread) {
    throw new Error('Chat thread not found');
  }
  if (userId != null && chatThread.userId.toString() !== userId.toString()) {
    throw new Error('Not authorized');
  }

  const messages = await ChatMessage.find({ chatThreadId }).sort({ createdAt: 1 });
  const llmMessages = messages.map(m => ({
    role: m.role,
    content: m.content
  }));
  llmMessages.push({ role: 'user', content });

  if (chatThread.title == null) {
    getChatCompletion([
      { role: 'system', content: 'Summarize the following chat thread in 6 words or less, as a helpful thread title' },
      ...llmMessages
    ], authorization).then(res => {
      const title = res.response;
      chatThread.title = title;
      return chatThread.save();
    }).catch(() => {});
  }

  llmMessages.unshift({
    role: 'system',
    content: systemPrompt + getModelDescriptions(db)
  });
  if (options.context) {
    llmMessages.unshift({
      role: 'system',
      content: options.context
    });
  }

  // Create the chat message and get OpenAI response in parallel
  const chatMessages = await Promise.all([
    ChatMessage.create({
      chatThreadId,
      role: 'user',
      content,
      script,
      executionResult: null
    }),
    getChatCompletion(llmMessages, authorization).then(res => {
      const content = res.response;
      return ChatMessage.create({
        chatThreadId,
        role: 'assistant',
        content
      });
    })
  ]);

  return { chatMessages, chatThread };
};

async function getChatCompletion(messages, authorization) {
  const response = await fetch('https://mongoose-js.netlify.app/.netlify/functions/createChatMessage', {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages
    })
  }).then(response => {
    if (response.status < 200 || response.status >= 400) {
      return response.json().then(data => {
        throw new Error(`Mongoose Studio chat completion error: ${data.message}`);
      });
    }
    return response;
  });

  return await response.json().then(res => {
    console.log('Response', res);
    return res;
  });
}
