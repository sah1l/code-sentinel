
import { describe, it, expect } from 'vitest';
import { getSystemPrompt, buildReviewPrompt } from './review.js';
import type { ReviewRequest } from '../llm/types.js';

describe('getSystemPrompt', () => {
  it('should return a non-empty system prompt', () => {
    const prompt = getSystemPrompt();

    expect(prompt).toBeTruthy();
    expect(prompt.length).toBeGreaterThan(100);
  });

  it('should include key review categories', () => {
    const prompt = getSystemPrompt();

    expect(prompt).toContain('Security');
    expect(prompt).toContain('Architecture');
    expect(prompt).toContain('Performance');
    expect(prompt).toContain('Bugs');
  });

  it('should include JSON response format instructions', () => {
    const prompt = getSystemPrompt();

    expect(prompt).toContain('JSON');
    expect(prompt).toContain('summary');
    expect(prompt).toContain('effortScore');
    expect(prompt).toContain('issues');
  });

  it('should include severity levels', () => {
    const prompt = getSystemPrompt();

    expect(prompt).toContain('critical');
    expect(prompt).toContain('warning');
    expect(prompt).toContain('suggestion');
    expect(prompt).toContain('nitpick');
  });
});

describe('buildReviewPrompt', () => {
  const createMockRequest = (overrides: Partial<ReviewRequest> = {}): ReviewRequest => ({
    pr: {
      title: 'Add user authentication',
      body: 'This PR adds JWT-based authentication',
      author: 'testuser',
    },
    diff: '@@ -1,0 +1,10 @@\n+const auth = () => {};',
    changedFiles: [
      {
        path: 'src/auth.ts',
        content: 'export const auth = () => {};',
        role: 'changed',
      },
    ],
    relatedFiles: [],
    context: {
      instructions: [],
      patterns: [],
    },
    categories: ['security', 'bugs'],
    ...overrides,
  });

  it('should include PR information', () => {
    const request = createMockRequest();
    const prompt = buildReviewPrompt(request);

    expect(prompt).toContain('Add user authentication');
    expect(prompt).toContain('testuser');
    expect(prompt).toContain('JWT-based authentication');
  });

  it('should include the diff', () => {
    const request = createMockRequest();
    const prompt = buildReviewPrompt(request);

    expect(prompt).toContain('```diff');
    expect(prompt).toContain('+const auth = () => {};');
  });

  it('should include changed files', () => {
    const request = createMockRequest();
    const prompt = buildReviewPrompt(request);

    expect(prompt).toContain('src/auth.ts');
    expect(prompt).toContain('export const auth = () => {};');
  });

  it('should include review categories', () => {
    const request = createMockRequest();
    const prompt = buildReviewPrompt(request);

    expect(prompt).toContain('security');
    expect(prompt).toContain('bugs');
  });

  it('should include conventions from CLAUDE.md', () => {
    const request = createMockRequest({
      context: {
        conventions: '# Team Conventions\n- Use TypeScript strict mode',
        instructions: [],
        patterns: [],
      },
    });
    const prompt = buildReviewPrompt(request);

    expect(prompt).toContain('Team Conventions');
    expect(prompt).toContain('Use TypeScript strict mode');
  });

  it('should include custom instructions', () => {
    const request = createMockRequest({
      context: {
        instructions: ['Always use async/await', 'Prefer const over let'],
        patterns: [],
      },
    });
    const prompt = buildReviewPrompt(request);

    expect(prompt).toContain('Custom Instructions');
    expect(prompt).toContain('Always use async/await');
    expect(prompt).toContain('Prefer const over let');
  });

  it('should include team patterns', () => {
    const request = createMockRequest({
      context: {
        instructions: [],
        patterns: [
          { category: 'naming', pattern: 'Use camelCase for variables' },
          { category: 'architecture', pattern: 'Controllers call services only' },
        ],
      },
    });
    const prompt = buildReviewPrompt(request);

    expect(prompt).toContain('Team Patterns');
    expect(prompt).toContain('naming');
    expect(prompt).toContain('Use camelCase for variables');
    expect(prompt).toContain('architecture');
  });

  it('should include related files', () => {
    const request = createMockRequest({
      relatedFiles: [
        {
          path: 'src/existing-auth.ts',
          content: 'export const existingAuth = () => {};',
          role: 'sibling',
        },
      ],
    });
    const prompt = buildReviewPrompt(request);

    expect(prompt).toContain('Related Files');
    expect(prompt).toContain('src/existing-auth.ts');
    expect(prompt).toContain('sibling');
  });

  it('should truncate long content', () => {
    const longContent = 'x'.repeat(10000);
    const request = createMockRequest({
      diff: longContent,
    });
    const prompt = buildReviewPrompt(request);

    expect(prompt).toContain('truncated');
    expect(prompt.length).toBeLessThan(longContent.length);
  });
});
