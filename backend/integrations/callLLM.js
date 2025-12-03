'use strict';

const { createAnthropic } = require('@ai-sdk/anthropic');
const { createOpenAI } = require('@ai-sdk/openai');
const { generateText } = require('ai');

module.exports = async function callLLM(messages, system, options) {
  let provider = null;
  let model = null;
  if (options?.openAIAPIKey && options?.anthropicAPIKey) {
    throw new Error('Cannot set both OpenAI and Anthropic API keys');
  }

  if (options?.openAIAPIKey) {
    provider = createOpenAI({ apiKey: options.openAIAPIKey });
    model = options?.model ?? 'gpt-4o-mini';
  } else if (options?.anthropicAPIKey) {
    provider = createAnthropic({ apiKey: options.anthropicAPIKey });
    model = options?.model ?? 'claude-haiku-4-5-20251001';
  }

  if (provider) {
    return generateText({
      model: provider(model),
      system,
      messages
    });
  }

  const headers = { 'Content-Type': 'application/json' };
  const response = await fetch('https://mongoose-js.netlify.app/.netlify/functions/getChatCompletion', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages,
      model: options?.model
    })
  }).then(response => {
    if (!response.ok) {
      return response.json().then(data => {
        throw new Error(`Mongoose Studio chat completion error: ${data.message}`);
      });
    }
    return response;
  });

  return await response.json().then(res => ({ text: res.response }));
};
