'use strict';

const Archetype = require('archetype');
const assert = require('assert');
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
  createDraftScript: {
    $type: 'string'
  },
  aiTarget: {
    $type: 'string',
    $default: 'document',
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
  let { model, content, documentData, createDraftScript, currentDateTime,aiTarget, roles } = new StreamChatMessageParams(params);
  aiTarget = aiTarget === 'script' ? 'script' : 'document';

  await authorize('Model.streamChatMessage', roles);

  const Model = db.models[model];
  if (Model == null) {
    throw new Error(`Model ${model} not found`);
  }

  const modelDescriptions = getModelDescriptions({ models: { [Model.modelName]: Model } });
  let context = [
    modelDescriptions,
    'Current draft document:\n' + (documentData || '')
  ]
  if (aiTarget === 'script') {
    context = [
      modelDescriptions,
      'Current draft document (this becomes `draft` in the VM):\n' + (documentData || ''),
      'Current server script (may be empty, for context):\n' + (createDraftScript || '')
    ].join('\n\n');
  } else {
    context = [
      modelDescriptions,
      'Current draft document:\n' + (documentData || '')
    ].join('\n\n');
  }
  const systemPromptForTarget = aiTarget === 'script' ? scriptSystemPrompt : documentSystemPrompt;
 
  const system = [
    systemPromptForTarget,
    currentDateTime ? `Current date: ${currentDateTime}` : null,
    context,
    options?.context
  ].filter(Boolean).join('\n\n');

  const llmMessages = [{ role: 'user', content: [{ type: 'text', text: content }] }];
  const textStream = streamLLM(llmMessages, system, options);

  for await (const textPart of textStream) {
    yield { textPart };
  }

  return {};
};

const documentSystemPrompt = `
  You are a helpful assistant that drafts MongoDB documents for the user.

  Use the model description and the current draft document to refine the user's intent.

  Return only the updated document body as a JavaScript object literal. Do not use Markdown or code fences.
`.trim();

const scriptSystemPrompt = `
  You write server-side JavaScript for Mongoose Studio's create-document sandbox.

  The script runs on Node inside an async IIFE: (async () => { /* your code */ })().
  Bindings: draft (mutable object — the document being created), db (Mongoose connection with db.models), mongoose, Model (Mongoose model for this collection), ObjectId.

  Rules:
  - Output ONLY executable script body (statements only). No markdown, no code fences, no surrounding explanation.
  - Use await for database calls, e.g. const x = await db.models.SomeModel.findById(draft.someRef).lean();
  - Mutate draft to add or change fields. Do not return draft.
  - console.log is captured and shown to the user.

  Use the model description plus the current draft and existing script (if any) to fulfill the user's request.
`.trim();
