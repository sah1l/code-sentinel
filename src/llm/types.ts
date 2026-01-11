
import type { ReviewCategory, Severity, Pattern } from '../config/schema.js';

export interface FileContext {
  path: string;
  content: string;
  role: 'changed' | 'sibling' | 'import' | 'test';
}

export interface ReviewContext {
  conventions?: string;
  instructions: string[];
  patterns: Pattern[];
  stack?: CodebaseStack;
}

export interface CodebaseStack {
  languages: string[];
  frameworks: string[];
}

export interface ReviewRequest {
  pr: {
    title: string;
    body: string;
    author: string;
  };
  diff: string;
  changedFiles: FileContext[];
  relatedFiles: FileContext[];
  context: ReviewContext;
  categories: ReviewCategory[];
}

export interface ReviewIssue {
  severity: Severity;
  category: ReviewCategory;
  file: string;
  line?: number;
  endLine?: number;
  title: string;
  description: string;
  suggestion?: string;
  codeBlock?: string;
}

export interface ReviewResponse {
  summary: string;
  effortScore: 1 | 2 | 3 | 4 | 5;
  issues: ReviewIssue[];
}

export interface LLMProvider {
  readonly name: string;
  analyze(request: ReviewRequest): Promise<ReviewResponse>;
}

export const REVIEW_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'A brief summary of the code changes and overall assessment',
    },
    effortScore: {
      type: 'number',
      minimum: 1,
      maximum: 5,
      description: 'Estimated effort to review this PR (1=trivial, 5=complex)',
    },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: {
            type: 'string',
            enum: ['critical', 'warning', 'suggestion', 'nitpick'],
          },
          category: {
            type: 'string',
            enum: ['security', 'architecture', 'performance', 'best-practices', 'bugs'],
          },
          file: { type: 'string' },
          line: { type: 'number' },
          endLine: { type: 'number' },
          title: { type: 'string' },
          description: { type: 'string' },
          suggestion: { type: 'string' },
          codeBlock: { type: 'string' },
        },
        required: ['severity', 'category', 'file', 'title', 'description'],
      },
    },
  },
  required: ['summary', 'effortScore', 'issues'],
};
