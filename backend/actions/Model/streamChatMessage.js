'use strict';

const Archetype = require('archetype');
const assert = require('assert');
const authorize = require('../../authorize');
const getAgentTools = require('../../chatAgent/getAgentTools');
const streamLLM = require('../../integrations/streamLLM');
const getModelDescriptions = require('../../helpers/getModelDescriptions');

const StreamChatMessageParams = new Archetype({
  model: {
    $type: 'string',
    $required: true
  },
  content: {
    $type: 'string',
    $required: true
  },
  documentData: {
    $type: 'string'
  },
  agentMode: {
    $type: 'boolean',
    $default: true
  },
  currentDateTime: {
    $type: 'string',
    $transform: v => v == null ? null : decodeURIComponent(v),
    $validate: v => assert.ok(v == null || v.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/))
  },
  roles: {
    $type: ['string']
  }
}).compile('StreamChatMessageParams');

module.exports = ({ db, options }) => async function* streamChatMessage(params) {
  const { model, content, documentData, currentDateTime, agentMode, roles } = new StreamChatMessageParams(params);

  await authorize('Model.streamChatMessage', roles);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  const modelDescriptions = getModelDescriptions({ models: { [Model.modelName]: Model } });
  const context = [
    modelDescriptions,
    'Current draft document:\n' + (documentData || '')
  ].join('\n\n');
  const system = [
    systemPrompt,
    currentDateTime ? `Current date: ${currentDateTime}` : null,
    context,
    options?.context
  ].filter(Boolean).join('\n\n');

  const llmMessages = [{ role: 'user', content: [{ type: 'text', text: content }] }];
  const llmOptions = agentMode ? { ...options, tools: getAgentTools(db) } : options;
  const textStream = streamLLM(llmMessages, system, llmOptions);

  for await (const textPart of textStream) {
    yield { textPart };
  }

  return {};
};

const systemPrompt = `
  You are a helpful assistant that drafts MongoDB documents for the user.

  Use the model description and the current draft document to refine the user's intent.

  Return only the updated document body as a JavaScript object literal. Do not use Markdown or code fences.
`.trim();
