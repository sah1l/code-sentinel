
import { describe, it, expect } from 'vitest';
import { OutputFormatter } from './formatter.js';
import type { SentinelConfig } from '../config/schema.js';
import type { ReviewResponse, ReviewIssue } from '../llm/types.js';

const createMockConfig = (overrides: Partial<SentinelConfig> = {}): SentinelConfig => ({
  llm: { provider: 'openai' },
  review: {
    categories: ['security', 'bugs'],
    min_severity: 'suggestion',
    skip_if_effort_below: 1,
  },
  ignore: { paths: [], authors: [] },
  instructions: [],
  patterns: [],
  output: {
    summary: true,
    inline_comments: true,
    max_inline_comments: 15,
    labels: {
      enabled: true,
      security_issue: 'security',
      needs_review: 'needs-review',
      effort_prefix: 'effort:',
    },
  },
  claude_md: { enabled: true },
  ...overrides,
});

describe('OutputFormatter', () => {
  describe('formatSummary', () => {
    it('should format a review with no issues', () => {
      const config = createMockConfig();
      const formatter = new OutputFormatter(config, 'openai');

      const response: ReviewResponse = {
        summary: 'Looks good!',
        effortScore: 2,
        issues: [],
      };

      const output = formatter.format(response, []);

      expect(output.summary).toContain('## Code Sentinel Review');
      expect(output.summary).toContain('Looks good!');
      expect(output.summary).toContain('(2/5)');
      expect(output.summary).toContain('No issues found');
      expect(output.summary).toContain('openai');
    });

    it('should format a review with issues by severity', () => {
      const config = createMockConfig();
      const formatter = new OutputFormatter(config, 'gpt-4o');

      const response: ReviewResponse = {
        summary: 'Found some issues.',
        effortScore: 3,
        issues: [],
      };

      const issues: ReviewIssue[] = [
        {
          severity: 'critical',
          category: 'security',
          file: 'src/auth.ts',
          line: 10,
          title: 'SQL Injection',
          description: 'User input not sanitized',
        },
        {
          severity: 'warning',
          category: 'performance',
          file: 'src/db.ts',
          line: 25,
          title: 'N+1 Query',
          description: 'Consider eager loading',
        },
        {
          severity: 'suggestion',
          category: 'best-practices',
          file: 'src/utils.ts',
          title: 'Add error handling',
          description: 'Function should handle errors',
        },
      ];

      const output = formatter.format(response, issues);

      expect(output.summary).toContain('Critical (1)');
      expect(output.summary).toContain('Warnings (1)');
      expect(output.summary).toContain('Suggestions (1)');
      expect(output.summary).toContain('SQL Injection');
      expect(output.summary).toContain('src/auth.ts:10');
      expect(output.summary).toContain('N+1 Query');
    });

    it('should display correct star rating', () => {
      const config = createMockConfig();
      const formatter = new OutputFormatter(config, 'openai');

      const response: ReviewResponse = {
        summary: 'Test',
        effortScore: 4,
        issues: [],
      };

      const output = formatter.format(response, []);

      expect(output.summary).toContain('(4/5)');
    });
  });

  describe('formatInlineComments', () => {
    it('should create inline comments for issues with line numbers', () => {
      const config = createMockConfig();
      const formatter = new OutputFormatter(config, 'openai');

      const response: ReviewResponse = {
        summary: 'Found issues.',
        effortScore: 3,
        issues: [],
      };

      const issues: ReviewIssue[] = [
        {
          severity: 'critical',
          category: 'security',
          file: 'src/auth.ts',
          line: 10,
          title: 'SQL Injection',
          description: 'User input not sanitized',
          suggestion: 'Use parameterized queries',
        },
        {
          severity: 'warning',
          category: 'bugs',
          file: 'src/utils.ts',
          // No line number
          title: 'Missing null check',
          description: 'Could throw NPE',
        },
      ];

      const output = formatter.format(response, issues);

      expect(output.inlineComments).toHaveLength(1);
      expect(output.inlineComments[0].path).toBe('src/auth.ts');
      expect(output.inlineComments[0].line).toBe(10);
      expect(output.inlineComments[0].body).toContain('SQL Injection');
      expect(output.inlineComments[0].body).toContain('Use parameterized queries');
      expect(output.inlineComments[0].side).toBe('RIGHT');
    });

    it('should respect max_inline_comments limit', () => {
      const config = createMockConfig({
        output: {
          summary: true,
          inline_comments: true,
          max_inline_comments: 2,
          labels: {
            enabled: true,
            security_issue: 'security',
            needs_review: 'needs-review',
            effort_prefix: 'effort:',
          },
        },
      });
      const formatter = new OutputFormatter(config, 'openai');

      const response: ReviewResponse = {
        summary: 'Found issues.',
        effortScore: 3,
        issues: [],
      };

      const issues: ReviewIssue[] = Array.from({ length: 5 }, (_, i) => ({
        severity: 'warning' as const,
        category: 'bugs' as const,
        file: `src/file${i}.ts`,
        line: i + 1,
        title: `Issue ${i}`,
        description: `Description ${i}`,
      }));

      const output = formatter.format(response, issues);

      expect(output.inlineComments).toHaveLength(2);
    });

    it('should include code block in inline comment when provided', () => {
      const config = createMockConfig();
      const formatter = new OutputFormatter(config, 'openai');

      const response: ReviewResponse = {
        summary: 'Found issues.',
        effortScore: 3,
        issues: [],
      };

      const issues: ReviewIssue[] = [
        {
          severity: 'suggestion',
          category: 'best-practices',
          file: 'src/utils.ts',
          line: 5,
          title: 'Use const',
          description: 'Prefer const over let',
          codeBlock: 'const x = 1;',
        },
      ];

      const output = formatter.format(response, issues);

      expect(output.inlineComments[0].body).toContain('```');
      expect(output.inlineComments[0].body).toContain('const x = 1;');
    });
  });

  describe('generateLabels', () => {
    it('should add security label for critical security issues', () => {
      const config = createMockConfig();
      const formatter = new OutputFormatter(config, 'openai');

      const response: ReviewResponse = {
        summary: 'Security issue found.',
        effortScore: 3,
        issues: [],
      };

      const issues: ReviewIssue[] = [
        {
          severity: 'critical',
          category: 'security',
          file: 'src/auth.ts',
          title: 'Vulnerability',
          description: 'Security issue',
        },
      ];

      const output = formatter.format(response, issues);

      expect(output.labels).toContain('security');
      expect(output.labels).toContain('effort:3');
    });

    it('should add security label for warning security issues', () => {
      const config = createMockConfig();
      const formatter = new OutputFormatter(config, 'openai');

      const response: ReviewResponse = {
        summary: 'Security warning.',
        effortScore: 2,
        issues: [],
      };

      const issues: ReviewIssue[] = [
        {
          severity: 'warning',
          category: 'security',
          file: 'src/auth.ts',
          title: 'Potential issue',
          description: 'Security warning',
        },
      ];

      const output = formatter.format(response, issues);

      expect(output.labels).toContain('security');
    });

    it('should not add security label for suggestion severity', () => {
      const config = createMockConfig();
      const formatter = new OutputFormatter(config, 'openai');

      const response: ReviewResponse = {
        summary: 'Minor suggestion.',
        effortScore: 1,
        issues: [],
      };

      const issues: ReviewIssue[] = [
        {
          severity: 'suggestion',
          category: 'security',
          file: 'src/auth.ts',
          title: 'Consider',
          description: 'Security suggestion',
        },
      ];

      const output = formatter.format(response, issues);

      expect(output.labels).not.toContain('security');
      expect(output.labels).toContain('effort:1');
    });

    it('should not generate labels when disabled', () => {
      const config = createMockConfig({
        output: {
          summary: true,
          inline_comments: true,
          max_inline_comments: 15,
          labels: {
            enabled: false,
            security_issue: 'security',
            needs_review: 'needs-review',
            effort_prefix: 'effort:',
          },
        },
      });
      const formatter = new OutputFormatter(config, 'openai');

      const response: ReviewResponse = {
        summary: 'Issues found.',
        effortScore: 3,
        issues: [],
      };

      const issues: ReviewIssue[] = [
        {
          severity: 'critical',
          category: 'security',
          file: 'src/auth.ts',
          title: 'Critical',
          description: 'Critical issue',
        },
      ];

      const output = formatter.format(response, issues);

      expect(output.labels).toHaveLength(0);
    });
  });
});
