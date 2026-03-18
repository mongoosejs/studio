'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
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
  roles: {
    $type: ['string']
  }
}).compile('StreamChatMessageParams');

module.exports = ({ db, options }) => async function* streamChatMessage(params) {
  const { model, content, documentData, roles } = new StreamChatMessageParams(params);

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
  const currentDateContext = `Current date: ${new Date().toISOString().slice(0, 10)}`;
  const system = [systemPrompt, currentDateContext, context, options?.context].filter(Boolean).join('\n\n');

  const llmMessages = [{ role: 'user', content: [{ type: 'text', text: content }] }];
  const textStream = streamLLM(llmMessages, system, options);

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
