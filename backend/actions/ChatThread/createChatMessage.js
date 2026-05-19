'use strict';

const Archetype = require('archetype');
const assert = require('assert');
const authorize = require('../../authorize');
const agentSystemPrompt = require('../../chatAgent/agentSystemPrompt');
const callLLM = require('../../integrations/callLLM');
const getAgentTools = require('../../chatAgent/getAgentTools');
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
    $type: 'string'
  },
  currentDateTime: {
    $type: 'string',
    $validate: v => assert.ok(v == null || v.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/))
  },
  roles: {
    $type: ['string']
  }
}).compile('CreateChatMessageParams');

module.exports = ({ db, studioConnection, options }) => async function createChatMessage(params) {
  const { chatThreadId, initiatedById, content, currentDateTime, script, roles } = new CreateChatMessageParams(params);
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
    content: [{
      type: 'text',
      text: m.content
    }]
  }));
  llmMessages.push({ role: 'user', content: [{ type: 'text', text: content }] });

  let summarizePromise = Promise.resolve();
  if (chatThread.title == null) {
    const threadText = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .concat([{ role: 'user', content }])
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n')
      .slice(0, 5000);
    summarizePromise = callLLM(
      [{
        role: 'user',
        content: [{
          type: 'text',
          text: 'Summarize the following chat thread into a concise, helpful title (≤ 6 words).\n\n' +
            `${threadText}\n\n` +
            'Return only the title.'
        }]
      }],
      'You are a helpful assistant that summarizes chat threads into titles.',
      options
    ).then(res => {
      const title = res.text;
      chatThread.title = title;
      return chatThread.save();
    });
  }

  const modelDescriptions = getModelDescriptions(db);
  const system = [
    chatThread.agentMode ? agentSystemPrompt : systemPrompt,
    currentDateTime ? `Current date: ${currentDateTime}` : null,
    modelDescriptions,
    options?.context
  ].filter(Boolean).join('\n\n');

  const llmOptions = chatThread.agentMode ? { ...options, tools: getAgentTools(db) } : options;

  // Create the chat message and get LLM response in parallel
  const chatMessages = await Promise.all([
    ChatMessage.create({
      chatThreadId,
      role: 'user',
      content,
      script,
      executionResult: null
    }),
    callLLM(llmMessages, system, llmOptions).then(res => {
      const content = res.text;
      const toolCalls = (res.steps || []).flatMap(step =>
        (step.toolCalls || []).map(tc => ({
          toolName: tc.toolName,
          input: tc.toolName === 'typeCheck' ? {} : tc.args,
          status: 'done'
        }))
      );
      return ChatMessage.create({
        chatThreadId,
        role: 'assistant',
        content,
        toolCalls: toolCalls.length ? toolCalls : undefined
      });
    })
  ]);

  await summarizePromise;
  return { chatMessages, chatThread };
};

const systemPrompt = `
You are a data querying assistant who writes scripts for users accessing MongoDB data using Node.js and Mongoose.

The following globals are available. Assume no other globals exist.
- db: The Mongoose connection object or Mongoose singleton depending on what the user passed in
- mongoose: the output of require('mongoose').
- ObjectId: MongoDB ObjectId class from mongoose.Types.ObjectId
- console: has a stubbed log() function that logs to the console and is accessible in the output.
- MongooseStudioChartColors: an array of 8 hex color strings for use as chart dataset colors.

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

If the user's query is best answered with a chart, return a Chart.js 4 configuration as \`return { $chart: chartJSConfig };\`. Disable ChartJS animation by default unless user asks for it. Set responsive: true, maintainAspectRatio: false options unless the user explicitly asks. Use MongooseStudioChartColors for dataset backgroundColor and borderColor by default. For line/bar charts, use MongooseStudioChartColors[i] as borderColor and MongooseStudioChartColors[i] + '33' as backgroundColor for each dataset. For pie/doughnut charts, use MongooseStudioChartColors.slice(0, data.length) as backgroundColor. Only use custom colors if the user explicitly requests specific colors.

If the user\'s query is best answered by a map, return an object { $featureCollection } which contains a GeoJSON FeatureCollection

If the user's query is best answered by a table, return an object { $table: { columns: string[], rows: any[][] } }

Example output:

The following script counts the number of users which are not deleted.

\`\`\`javascript
const users = await db.model('User').find({ isDeleted: false });
return { numUsers: users.length };
\`\`\`

-----------

Here is a description of the user's models. Assume these are the only models available in the system unless explicitly instructed otherwise by the user.
`.trim();
