'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const getModelDescriptions = require('../../helpers/getModelDescriptions');
const mongoose = require('mongoose');

const CreateChatMessageParams = new Archetype({
  chatThreadId: {
    $type: mongoose.Types.ObjectId
  },
  initiatedById: {
    $type: mongoose.Types.ObjectId
  },
  content: {
    $type: String
  },
  authorization: {
    $type: 'string'
  },
  roles: {
    $type: ['string']
  }
}).compile('CreateChatMessageParams');

module.exports = ({ db, studioConnection, options }) => async function createChatMessage(params) {
  const { chatThreadId, initiatedById, content, script, authorization, roles } = new CreateChatMessageParams(params);
  const ChatThread = studioConnection.model('__Studio_ChatThread');
  const ChatMessage = studioConnection.model('__Studio_ChatMessage');

  await authorize('ChatThread.createChatMessage', roles);

  // Check that the user owns the thread
  const chatThread = await ChatThread.findOne({ _id: chatThreadId });
  if (!chatThread) {
    throw new Error('Chat thread not found');
  }
  if (initiatedById != null && chatThread.userId.toString() !== initiatedById.toString()) {
    throw new Error('Not authorized');
  }

  const messages = await ChatMessage.find({ chatThreadId }).sort({ createdAt: 1 });
  const llmMessages = messages.map(m => ({
    role: m.role,
    content: m.content
  }));
  llmMessages.push({ role: 'user', content });

  let summarizePromise = Promise.resolve();
  if (chatThread.title == null) {
    summarizePromise = summarizeChatThread(llmMessages, authorization, options).then(res => {
      const title = res.response;
      chatThread.title = title;
      return chatThread.save();
    });
  }

  if (options.context) {
    llmMessages.unshift({
      role: 'system',
      content: options.context
    });
  }

  const modelDescriptions = getModelDescriptions(db);

  // Create the chat message and get OpenAI response in parallel
  const chatMessages = await Promise.all([
    ChatMessage.create({
      chatThreadId,
      role: 'user',
      content,
      script,
      executionResult: null
    }),
    createChatMessageCore(llmMessages, modelDescriptions, options?.model, authorization, options).then(res => {
      const content = res.response;
      return ChatMessage.create({
        chatThreadId,
        role: 'assistant',
        content
      });
    })
  ]);

  await summarizePromise;
  return { chatMessages, chatThread };
};

async function summarizeChatThread(messages, authorization, options) {
  if (options?.openAIAPIKey) {
    const response = await callOpenAI({
      apiKey: options.openAIAPIKey,
      model: options.model,
      messages: [
        {
          role: 'system',
          content: 'Summarize the following conversation into a concise title of at most 7 words. Respond with the title only.'
        },
        ...messages
      ]
    });

    return { response };
  }

  const headers = { 'Content-Type': 'application/json' };
  if (authorization) {
    headers.Authorization = authorization;
  }
  const response = await fetch('https://mongoose-js.netlify.app/.netlify/functions/summarizeChatThread', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages
    })
  }).then(response => {
    if (response.status < 200 || response.status >= 400) {
      return response.json().then(data => {
        throw new Error(`Mongoose Studio chat thread summarization error: ${data.message}`);
      });
    }
    return response;
  });

  return await response.json();
}

async function createChatMessageCore(messages, modelDescriptions, model, authorization, options) {
  if (options?.openAIAPIKey) {
    const openAIMessages = [];
    if (modelDescriptions) {
      openAIMessages.push({
        role: 'system',
        content: `${systemPrompt}:\n\n${modelDescriptions}`
      });
    }
    openAIMessages.push(...messages);

    const response = await callOpenAI({
      apiKey: options.openAIAPIKey,
      model,
      messages: openAIMessages
    });

    return { response };
  }

  const headers = { 'Content-Type': 'application/json' };
  if (authorization) {
    headers.Authorization = authorization;
  }
  const response = await fetch('https://mongoose-js.netlify.app/.netlify/functions/createChatMessage', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages,
      modelDescriptions,
      model
    })
  }).then(response => {
    if (response.status < 200 || response.status >= 400) {
      return response.json().then(data => {
        throw new Error(`Mongoose Studio chat completion error: ${data.message}`);
      });
    }
    return response;
  });

  return await response.json();
}

const systemPrompt = `
You are a data querying assistant who writes scripts for users accessing MongoDB data using Node.js and Mongoose.

Keep scripts concise. Avoid unnecessary comments, error handling, and temporary variables.

Do not write any imports or require() statements, that will cause the script to break.

If the user approves the script, the script will run in the Node.js server in a sandboxed vm.createContext() call with only 1 global variable: db, which contains the Mongoose connection. The script return value will then send the response via JSON to the client. Be aware that the result of the query will be serialized to JSON before being displayed to the user. MAKE SURE TO RETURN A VALUE FROM THE SCRIPT.

Optimize scripts for readability first, followed by reliability, followed by performance. Avoid using the aggregation framework unless explicitly requested by the user. Use indexed fields in queries where possible.

Assume the user has pre-defined schemas and models. Do not define any new schemas or models for the user.

Use async/await where possible. Assume top-level await is allowed.

Write at most one script, unless the user explicitly asks for multiple scripts.

Think carefully about the user's input and identify the models referred to by the user's query.

Format output as Markdown, including code fences for any scripts the user requested.

Add a brief text description of what the script does.

If the user's query is best answered with a chart, return a Chart.js 4 configuration as \`return { $chart: chartJSConfig };\`. Disable ChartJS animation by default unless user asks for it. Set responsive: true, maintainAspectRatio: false options unless the user explicitly asks.

If the user\'s query is best answered by a map, return an object { $featureCollection } which contains a GeoJSON FeatureCollection

Example output:

The following script counts the number of users which are not deleted.

\`\`\`javascript
const users = await db.model('User').find({ isDeleted: false });
return { numUsers: users.length };
\`\`\`

-----------

Here is a description of the user's models. Assume these are the only models available in the system unless explicitly instructed otherwise by the user.
`.trim();

async function callOpenAI({ apiKey, model, messages }) {
  if (!apiKey) {
    throw new Error('OpenAI API key required');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages
    })
  });

  const data = await response.json();

  if (response.status < 200 || response.status >= 400) {
    throw new Error(`OpenAI chat completion error ${response.status}: ${data.error?.message || data.message || 'Unknown error'}`);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI chat completion error: missing response content');
  }

  return content.trim();
}
