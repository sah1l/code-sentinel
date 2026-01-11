
import * as core from '@actions/core';
import type { SentinelConfig } from '../config/schema.js';
import type { LLMProvider } from './types.js';
import { OpenAIProvider } from './openai.js';
import { OllamaProvider } from './ollama.js';

export function createLLMProvider(config: SentinelConfig): LLMProvider {
  const { provider, model, base_url } = config.llm;

  switch (provider) {
    case 'openai': {
      const apiKey = core.getInput('openai_api_key');

      if (!apiKey) {
        throw new Error(
          'OpenAI API key is required. Set the openai_api_key input in your workflow.'
        );
      }

      return new OpenAIProvider(apiKey, model || 'gpt-4o');
    }

    case 'ollama': {
      const baseUrl = base_url || core.getInput('ollama_base_url') || 'http://localhost:11434';
      const ollamaModel = model || core.getInput('ollama_model') || 'codellama:13b';

      return new OllamaProvider(baseUrl, ollamaModel);
    }

    case 'anthropic': {
      throw new Error('Anthropic provider is not yet implemented. Coming soon!');
    }

    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
