
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContextCollector } from './context.js';
import type { PlatformAdapter, PullRequest, ChangedFile } from '../platforms/types.js';
import type { SentinelConfig } from '../config/schema.js';

// Mock platform adapter
const createMockPlatform = (): PlatformAdapter => ({
  name: 'mock',
  getPullRequest: vi.fn(),
  getFileContent: vi.fn(),
  getFilesInDirectory: vi.fn(),
  postReviewSummary: vi.fn(),
  postInlineComments: vi.fn(),
});

const createMockConfig = (overrides: Partial<SentinelConfig> = {}): SentinelConfig => ({
  llm: { provider: 'openai' },
  review: {
    categories: ['security', 'bugs'],
    min_severity: 'suggestion',
    skip_if_effort_below: 1,
  },
  ignore: {
    paths: ['**/*.test.ts', 'docs/**'],
    authors: [],
  },
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

const createMockPR = (files: ChangedFile[]): PullRequest => ({
  id: 1,
  title: 'Test PR',
  body: 'Test description',
  author: 'testuser',
  baseBranch: 'main',
  headBranch: 'feature/test',
  baseRef: 'abc123',
  headRef: 'def456',
  files,
});

describe('ContextCollector', () => {
  let mockPlatform: PlatformAdapter;
  let collector: ContextCollector;

  beforeEach(() => {
    mockPlatform = createMockPlatform();
  });

  describe('filterFiles', () => {
    it('should exclude deleted files', async () => {
      const config = createMockConfig({ ignore: { paths: [], authors: [] } });
      collector = new ContextCollector(mockPlatform, config);

      const pr = createMockPR([
        { filename: 'src/index.ts', status: 'modified', additions: 10, deletions: 5 },
        { filename: 'src/old.ts', status: 'deleted', additions: 0, deletions: 50 },
      ]);

      vi.mocked(mockPlatform.getFileContent).mockResolvedValue('const x = 1;');
      vi.mocked(mockPlatform.getFilesInDirectory).mockResolvedValue([]);

      const context = await collector.collect(pr);

      expect(context.changedFiles).toHaveLength(1);
      expect(context.changedFiles[0].path).toBe('src/index.ts');
    });

    it('should exclude files matching ignore patterns', async () => {
      const config = createMockConfig({
        ignore: { paths: ['**/*.test.ts', '**/*.spec.ts'], authors: [] },
      });
      collector = new ContextCollector(mockPlatform, config);

      const pr = createMockPR([
        { filename: 'src/index.ts', status: 'modified', additions: 10, deletions: 5 },
        { filename: 'src/index.test.ts', status: 'modified', additions: 20, deletions: 10 },
        { filename: 'src/utils.spec.ts', status: 'added', additions: 30, deletions: 0 },
      ]);

      vi.mocked(mockPlatform.getFileContent).mockResolvedValue('const x = 1;');
      vi.mocked(mockPlatform.getFilesInDirectory).mockResolvedValue([]);

      const context = await collector.collect(pr);

      expect(context.changedFiles).toHaveLength(1);
      expect(context.changedFiles[0].path).toBe('src/index.ts');
    });
  });

  describe('buildDiff', () => {
    it('should combine patches from all files', async () => {
      const config = createMockConfig({ ignore: { paths: [], authors: [] } });
      collector = new ContextCollector(mockPlatform, config);

      const pr = createMockPR([
        {
          filename: 'src/a.ts',
          status: 'modified',
          additions: 1,
          deletions: 1,
          patch: '@@ -1,1 +1,1 @@\n-old\n+new',
        },
        {
          filename: 'src/b.ts',
          status: 'modified',
          additions: 1,
          deletions: 0,
          patch: '@@ -1,0 +1,1 @@\n+added',
        },
      ]);

      vi.mocked(mockPlatform.getFileContent).mockResolvedValue('const x = 1;');
      vi.mocked(mockPlatform.getFilesInDirectory).mockResolvedValue([]);

      const context = await collector.collect(pr);

      expect(context.diff).toContain('src/a.ts');
      expect(context.diff).toContain('src/b.ts');
      expect(context.diff).toContain('-old');
      expect(context.diff).toContain('+new');
      expect(context.diff).toContain('+added');
    });
  });

  describe('collectChangedFiles', () => {
    it('should fetch content for each changed file', async () => {
      const config = createMockConfig({ ignore: { paths: [], authors: [] } });
      collector = new ContextCollector(mockPlatform, config);

      const pr = createMockPR([
        { filename: 'src/index.ts', status: 'modified', additions: 10, deletions: 5 },
        { filename: 'src/utils.ts', status: 'added', additions: 20, deletions: 0 },
      ]);

      vi.mocked(mockPlatform.getFileContent)
        .mockResolvedValueOnce('export const main = () => {};')
        .mockResolvedValueOnce('export const util = () => {};');
      vi.mocked(mockPlatform.getFilesInDirectory).mockResolvedValue([]);

      const context = await collector.collect(pr);

      expect(context.changedFiles).toHaveLength(2);
      expect(context.changedFiles[0].content).toBe('export const main = () => {};');
      expect(context.changedFiles[1].content).toBe('export const util = () => {};');
    });

    it('should handle files that cannot be read', async () => {
      const config = createMockConfig({ ignore: { paths: [], authors: [] } });
      collector = new ContextCollector(mockPlatform, config);

      const pr = createMockPR([
        { filename: 'src/index.ts', status: 'modified', additions: 10, deletions: 5 },
      ]);

      vi.mocked(mockPlatform.getFileContent).mockResolvedValue(null);
      vi.mocked(mockPlatform.getFilesInDirectory).mockResolvedValue([]);

      const context = await collector.collect(pr);

      expect(context.changedFiles).toHaveLength(0);
    });
  });

  describe('reviewContext', () => {
    it('should include instructions and patterns from config', async () => {
      const config = createMockConfig({
        ignore: { paths: [], authors: [] },
        instructions: ['Use TypeScript', 'Follow SOLID'],
        patterns: [{ category: 'naming', pattern: 'Use camelCase' }],
      });
      collector = new ContextCollector(mockPlatform, config, 'CLAUDE.md content');

      const pr = createMockPR([
        { filename: 'src/index.ts', status: 'modified', additions: 10, deletions: 5 },
      ]);

      vi.mocked(mockPlatform.getFileContent).mockResolvedValue('const x = 1;');
      vi.mocked(mockPlatform.getFilesInDirectory).mockResolvedValue([]);

      const context = await collector.collect(pr);

      expect(context.reviewContext.conventions).toBe('CLAUDE.md content');
      expect(context.reviewContext.instructions).toEqual(['Use TypeScript', 'Follow SOLID']);
      expect(context.reviewContext.patterns).toHaveLength(1);
      expect(context.reviewContext.patterns[0].pattern).toBe('Use camelCase');
    });
  });
});
