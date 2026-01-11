
import { describe, it, expect } from 'vitest';
import {
  SentinelConfigSchema,
  defaultConfig,
  ReviewCategorySchema,
  SeveritySchema,
  LLMProviderSchema,
} from './schema.js';

describe('SentinelConfigSchema', () => {
  describe('defaultConfig', () => {
    it('should have valid default values', () => {
      expect(defaultConfig.llm.provider).toBe('openai');
      expect(defaultConfig.review.categories).toContain('security');
      expect(defaultConfig.review.min_severity).toBe('suggestion');
      expect(defaultConfig.output.summary).toBe(true);
      expect(defaultConfig.output.inline_comments).toBe(true);
    });
  });

  describe('parse', () => {
    it('should parse empty object with defaults', () => {
      const result = SentinelConfigSchema.parse({});

      expect(result.llm.provider).toBe('openai');
      expect(result.review.categories).toEqual(['security', 'architecture', 'bugs']);
      expect(result.ignore.paths).toEqual([]);
      expect(result.instructions).toEqual([]);
    });

    it('should parse full config', () => {
      const config = {
        llm: {
          provider: 'ollama',
          model: 'codellama:7b',
          base_url: 'http://localhost:11434',
        },
        review: {
          categories: ['security', 'performance'],
          min_severity: 'warning',
          skip_if_effort_below: 2,
        },
        ignore: {
          paths: ['**/*.test.ts'],
          authors: ['dependabot[bot]'],
        },
        instructions: ['Use TypeScript strict mode'],
        patterns: [
          {
            category: 'naming',
            pattern: 'Use camelCase',
          },
        ],
        output: {
          summary: true,
          inline_comments: false,
          max_inline_comments: 10,
        },
      };

      const result = SentinelConfigSchema.parse(config);

      expect(result.llm.provider).toBe('ollama');
      expect(result.llm.model).toBe('codellama:7b');
      expect(result.review.categories).toEqual(['security', 'performance']);
      expect(result.review.min_severity).toBe('warning');
      expect(result.ignore.paths).toContain('**/*.test.ts');
      expect(result.instructions).toContain('Use TypeScript strict mode');
      expect(result.patterns[0].category).toBe('naming');
      expect(result.output.inline_comments).toBe(false);
    });

    it('should reject invalid provider', () => {
      expect(() =>
        SentinelConfigSchema.parse({
          llm: { provider: 'invalid' },
        })
      ).toThrow();
    });

    it('should reject invalid severity', () => {
      expect(() =>
        SentinelConfigSchema.parse({
          review: { min_severity: 'invalid' },
        })
      ).toThrow();
    });

    it('should reject max_inline_comments over 50', () => {
      expect(() =>
        SentinelConfigSchema.parse({
          output: { max_inline_comments: 100 },
        })
      ).toThrow();
    });

    it('should accept max_inline_comments at boundary', () => {
      const result = SentinelConfigSchema.parse({
        output: { max_inline_comments: 50 },
      });

      expect(result.output.max_inline_comments).toBe(50);
    });
  });
});

describe('ReviewCategorySchema', () => {
  it('should accept valid categories', () => {
    expect(ReviewCategorySchema.parse('security')).toBe('security');
    expect(ReviewCategorySchema.parse('architecture')).toBe('architecture');
    expect(ReviewCategorySchema.parse('performance')).toBe('performance');
    expect(ReviewCategorySchema.parse('best-practices')).toBe('best-practices');
    expect(ReviewCategorySchema.parse('bugs')).toBe('bugs');
  });

  it('should reject invalid categories', () => {
    expect(() => ReviewCategorySchema.parse('invalid')).toThrow();
  });
});

describe('SeveritySchema', () => {
  it('should accept valid severities', () => {
    expect(SeveritySchema.parse('critical')).toBe('critical');
    expect(SeveritySchema.parse('warning')).toBe('warning');
    expect(SeveritySchema.parse('suggestion')).toBe('suggestion');
    expect(SeveritySchema.parse('nitpick')).toBe('nitpick');
  });

  it('should reject invalid severities', () => {
    expect(() => SeveritySchema.parse('error')).toThrow();
  });
});

describe('LLMProviderSchema', () => {
  it('should accept valid providers', () => {
    expect(LLMProviderSchema.parse('openai')).toBe('openai');
    expect(LLMProviderSchema.parse('ollama')).toBe('ollama');
    expect(LLMProviderSchema.parse('anthropic')).toBe('anthropic');
  });

  it('should reject invalid providers', () => {
    expect(() => LLMProviderSchema.parse('gemini')).toThrow();
  });
});
