'use strict';

const { createAnthropic } = require('@ai-sdk/anthropic');
const { createGoogleGenerativeAI } = require('@ai-sdk/google');
const { createOpenAI } = require('@ai-sdk/openai');
const { streamText, stepCountIs } = require('ai');

module.exports = async function* streamLLM(messages, system, options) {
  let provider = null;
  let model = null;
  const providers = [];

  if (options?.openAIAPIKey) {
    providers.push({
      name: 'OpenAI',
      provider: createOpenAI({ apiKey: options.openAIAPIKey }),
      model: options?.model ?? 'gpt-4o-mini'
    });
  }

  if (options?.anthropicAPIKey) {
    providers.push({
      name: 'Anthropic',
      provider: createAnthropic({ apiKey: options.anthropicAPIKey }),
      model: options?.model ?? 'claude-haiku-4-5-20251001'
    });
  }

  if (options?.googleGeminiAPIKey) {
    providers.push({
      name: 'Gemini',
      provider: createGoogleGenerativeAI({ apiKey: options.googleGeminiAPIKey }),
      model: options?.model ?? 'gemini-3.1-pro-preview'
    });
  }

  if (providers.length > 1) {
    throw new Error(`Cannot set multiple LLM API keys, found ${providers.map(p => p.name).join(', ')}`);
  }

  if (providers.length > 0) {
    const selected = providers[0];
    provider = selected.provider;
    model = selected.model;
  }

  if (provider) {
    let error = null;
    const { fullStream } = streamText({
      model: provider(model),
      system,
      messages,
      tools: options?.tools,
      stopWhen: options?.tools ? stepCountIs(10) : undefined,
      onError(err) {
        error = err.error;
      }
    });
    for await (const chunk of fullStream) {
      if (chunk.type === 'text-delta') {
        yield chunk.text;
      } else if (chunk.type === 'tool-call') {
        yield { toolCall: { toolName: chunk.toolName, input: chunk.input } };
      } else if (chunk.type === 'tool-result') {
        yield { toolResult: { toolName: chunk.toolName, output: chunk.output } };
      }
    }
    if (error) {
      throw error;
    }
    return;
  }

  throw new Error('No LLM API key configured. Set one of anthropicAPIKey, googleGeminiAPIKey, or openAIAPIKey.');
};
