
import * as core from '@actions/core';
import { Ollama } from 'ollama';
import type { LLMProvider, ReviewRequest, ReviewResponse } from './types.js';
import { buildReviewPrompt, getSystemPrompt } from '../prompts/review.js';

export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  private client: Ollama;
  private model: string;

  constructor(baseUrl = 'http://localhost:11434', model = 'codellama:13b') {
    this.client = new Ollama({ host: baseUrl });
    this.model = model;
  }

  async analyze(request: ReviewRequest): Promise<ReviewResponse> {
    const systemPrompt = getSystemPrompt();
    const userPrompt = buildReviewPrompt(request);

    core.info(`Sending review request to Ollama (${this.model})...`);
    core.debug(`Prompt length: ${userPrompt.length} characters`);

    try {
      const response = await this.client.chat({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        format: 'json',
        options: {
          temperature: 0.1,
          num_predict: 4096,
        },
      });

      const content = response.message?.content;

      if (!content) {
        throw new Error('Empty response from Ollama');
      }

      core.debug(`Ollama response: ${content.substring(0, 500)}...`);

      const parsed = JSON.parse(content) as ReviewResponse;

      return this.validateResponse(parsed);
    } catch (error) {
      if (error instanceof Error) {
        core.error(`Ollama error: ${error.message}`);

        if (error.message.includes('ECONNREFUSED')) {
          throw new Error(
            `Cannot connect to Ollama. Make sure Ollama is running at the configured URL.`
          );
        }
      }
      throw error;
    }
  }

  private validateResponse(response: unknown): ReviewResponse {
    const r = response as ReviewResponse;

    if (!r.summary || typeof r.summary !== 'string') {
      r.summary = 'Unable to generate summary.';
    }

    if (!r.effortScore || typeof r.effortScore !== 'number') {
      r.effortScore = 3;
    }

    r.effortScore = Math.max(1, Math.min(5, Math.round(r.effortScore))) as 1 | 2 | 3 | 4 | 5;

    if (!Array.isArray(r.issues)) {
      r.issues = [];
    }

    r.issues = r.issues.filter(
      (issue) =>
        issue &&
        typeof issue.severity === 'string' &&
        typeof issue.category === 'string' &&
        typeof issue.file === 'string' &&
        typeof issue.title === 'string' &&
        typeof issue.description === 'string'
    );

    return r;
  }
}
