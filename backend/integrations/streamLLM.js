'use strict';

const { createAnthropic } = require('@ai-sdk/anthropic');
const { createGoogleGenerativeAI } = require('@ai-sdk/google');
const { createOpenAI } = require('@ai-sdk/openai');
const { streamText } = require('ai');

module.exports = async function* streamLLM(messages, system, options) {
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
    let error = null;
    const { textStream } = streamText({
      model: provider(model),
      system,
      messages,
      onError(err) {
        error = err.error;
      }
    });
    for await (const chunk of textStream) {
      yield chunk;
    }
    if (error) {
      throw error;
    }
    return;
  }

  // If not using OpenAI, Anthropic, or Google Gemini, fallback to Mongoose (no streaming)
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

  const data = await response.json();

  // Simulate streaming by yielding the whole response at once as a single chunk
  yield data.response;
};
