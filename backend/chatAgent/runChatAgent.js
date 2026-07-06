'use strict';

const agentSystemPrompt = require('./agentSystemPrompt');
const getAgentTools = require('./getAgentTools');
const streamLLM = require('../integrations/streamLLM');
const getModelDescriptions = require('../helpers/getModelDescriptions');
const formatModelSkillsPrompt = require('../helpers/formatModelSkillsPrompt');

module.exports = function runChatAgent({ db, llmMessages, currentDateTime, options, modelSkills = {} }) {
  const system = [
    agentSystemPrompt,
    currentDateTime ? `Current date: ${currentDateTime}` : null,
    formatModelSkillsPrompt(modelSkills),
    getModelDescriptions(db, modelSkills),
    options?.context
  ].filter(Boolean).join('\n\n');

  return streamLLM(llmMessages, system, { ...options, tools: getAgentTools(db) });
};
