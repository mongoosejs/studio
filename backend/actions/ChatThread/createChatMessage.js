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
  }
}).compile('CreateChatMessageParams');

const systemPrompt = `
You are a data querying assistant who writes scripts for users accessing MongoDB data using Node.js and Mongoose.

Keep scripts concise. Avoid unnecessary comments, error handling, and temporary variables.

Do not write any imports or require() statements, that will cause the script to break.

Assume the user has pre-defined schemas and models. Do not define any new schemas or models for the user.

Use async/await where possible. Assume top-level await is allowed.

Think carefully about the user's input and identify the models referred to by the user's query.

Format output as Markdown, including code fences for any scripts the user requested.

Add a brief text description of what the script does.

If the user's query is best answered with a chart, return a Chart.js 4 configuration as \`return { $chart: chartJSConfig };\`. Disable ChartJS animation by default unless user asks for it.

Example output:

The following script counts the number of users which are not deleted.

\`\`\`javascript
const users = await db.model('User').find({ isDeleted: false });
return { numUsers: users.length };
\`\`\`

-----------

Here is a description of the user's models. Assume these are the only models available in the system unless explicitly instructed otherwise by the user.
`.trim();

module.exports = ({ db }) => async function createChatMessage(params) {
  const { chatThreadId, userId, content, script } = new CreateChatMessageParams(params);
  const ChatThread = db.model('__Studio_ChatThread');
  const ChatMessage = db.model('__Studio_ChatMessage');

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
    ]).then(res => {
      const title = res.choices?.[0]?.message?.content;
      chatThread.title = title;
      return chatThread.save();
    }).catch(() => {});
  }

  llmMessages.unshift({
    role: 'system',
    content: systemPrompt + getModelDescriptions(db)
  });

  // Create the chat message and get OpenAI response in parallel
  const chatMessages = await Promise.all([
    ChatMessage.create({
      chatThreadId,
      role: 'user',
      content,
      script,
      executionResult: null
    }),
    getChatCompletion(llmMessages).then(res => {
      const content = res.choices?.[0]?.message?.content || '';
      console.log('Content', content, res);
      return ChatMessage.create({
        chatThreadId,
        role: 'assistant',
        content
      });
    })
  ]);

  return { chatMessages };
};

async function getChatCompletion(messages, options = {}) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 2500,
      ...options,
      messages
    })
  });

  return await response.json();
};
