'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const callLLM = require('../../integrations/callLLM');
const getModelDescriptions = require('../../helpers/getModelDescriptions');

const CreateChatMessageParams = new Archetype({
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
  currentDateTime: {
    $type: 'string',
    $match: /^\d{4}-\d{2}-\d{2}-\d{2}:\d{2}:\d{2}$/
  },
  roles: {
    $type: ['string']
  }
}).compile('CreateChatMessageParams');

module.exports = ({ db, options }) => async function createChatMessage(params) {
  const { model, content, documentData, currentDateTime, roles } = new CreateChatMessageParams(params);

  await authorize('Model.createChatMessage', roles);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  const modelDescriptions = getModelDescriptions({ models: { [Model.modelName]: Model } });
  const context = [
    modelDescriptions,
    'Current draft document:\n' + (documentData || '')
  ].join('\n\n');
  const currentDateContext = currentDateTime ? `Current date: ${currentDateTime}` : null;
  const system = [systemPrompt, currentDateContext, context, options?.context].filter(Boolean).join('\n\n');

  const llmMessages = [{ role: 'user', content: [{ type: 'text', text: content }] }];
  const res = await callLLM(llmMessages, system, options);

  return { text: res.text };
};

const systemPrompt = `
  You are a helpful assistant that drafts MongoDB documents for the user.

  Use the model description and the current draft document to refine the user's intent.

  Return only the updated document body as a JavaScript object literal. Do not use Markdown or code fences.
`.trim();
