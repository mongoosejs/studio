'use strict';

const { createAnthropic } = require('@ai-sdk/anthropic');
const { createGoogleGenerativeAI } = require('@ai-sdk/google');
const { createOpenAI } = require('@ai-sdk/openai');
const { generateText } = require('ai');

module.exports = async function callLLM(messages, system, options) {
  let provider = null;
  let model = null;
  const providers = [];

  if (options?.openAIAPIKey) {
    providers.push({
      provider: createOpenAI({ apiKey: options.openAIAPIKey }),
      model: options?.model ?? 'gpt-4o-mini'
    });
  }

  if (options?.anthropicAPIKey) {
    providers.push({
      provider: createAnthropic({ apiKey: options.anthropicAPIKey }),
      model: options?.model ?? 'claude-haiku-4-5-20251001'
    });
  }

  if (options?.googleGeminiAPIKey) {
    providers.push({
      provider: createGoogleGenerativeAI({ apiKey: options.googleGeminiAPIKey }),
      model: options?.model ?? 'gemini-2.5-flash'
    });
  }

  if (providers.length > 1) {
    throw new Error('Cannot set multiple LLM API keys');
  }

  if (providers.length > 0) {
    const selected = providers[0];
    provider = selected.provider;
    model = selected.model;
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
      messages: [{ role: 'system', content: { type: 'text', text: system } }, ...messages],
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
