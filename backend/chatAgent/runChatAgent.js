'use strict';

const agentSystemPrompt = require('./agentSystemPrompt');
const getAgentTools = require('./getAgentTools');
const streamLLM = require('../integrations/streamLLM');
const getModelDescriptions = require('../helpers/getModelDescriptions');

module.exports = function runChatAgent({ db, llmMessages, currentDateTime, options }) {
  const system = [
    agentSystemPrompt,
    currentDateTime ? `Current date: ${currentDateTime}` : null,
    getModelDescriptions(db),
    options?.context
  ].filter(Boolean).join('\n\n');

  return streamLLM(llmMessages, system, { ...options, tools: getAgentTools(db) });
};
