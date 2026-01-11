
import * as path from 'node:path';
import * as core from '@actions/core';
import { minimatch } from 'minimatch';
import type { SentinelConfig } from '../config/schema.js';
import type { PlatformAdapter, PullRequest, ChangedFile } from '../platforms/types.js';
import type { FileContext, ReviewContext } from '../llm/types.js';

export interface CollectedContext {
  changedFiles: FileContext[];
  relatedFiles: FileContext[];
  reviewContext: ReviewContext;
  diff: string;
}

export class ContextCollector {
  constructor(
    private platform: PlatformAdapter,
    private config: SentinelConfig,
    private claudeMdContent?: string
  ) { }

  async collect(pr: PullRequest): Promise<CollectedContext> {
    core.info('Collecting context for review...');

    // Filter files based on ignore patterns
    const relevantFiles = this.filterFiles(pr.files);
    core.info(`${relevantFiles.length} files to review (after filtering)`);

    // Collect changed file contents
    const changedFiles = await this.collectChangedFiles(relevantFiles);

    // Collect related files for pattern reference
    const relatedFiles = await this.collectRelatedFiles(relevantFiles);

    // Build diff from patches
    const diff = this.buildDiff(relevantFiles);

    // Build review context
    const reviewContext: ReviewContext = {
      conventions: this.claudeMdContent,
      instructions: this.config.instructions,
      patterns: this.config.patterns,
    };

    return {
      changedFiles,
      relatedFiles,
      reviewContext,
      diff,
    };
  }

  private filterFiles(files: ChangedFile[]): ChangedFile[] {
    const ignorePaths = this.config.ignore.paths;

    return files.filter((file) => {
      // Skip deleted files (nothing to review)
      if (file.status === 'deleted') {
        return false;
      }

      // Check against ignore patterns
      for (const pattern of ignorePaths) {
        if (minimatch(file.filename, pattern)) {
          core.debug(`Ignoring ${file.filename} (matches ${pattern})`);
          return false;
        }
      }

      return true;
    });
  }

  private async collectChangedFiles(files: ChangedFile[]): Promise<FileContext[]> {
    const results: FileContext[] = [];

    for (const file of files) {
      const content = await this.platform.getFileContent(file.filename);

      if (content) {
        results.push({
          path: file.filename,
          content,
          role: 'changed',
        });
      }
    }

    return results;
  }

  private async collectRelatedFiles(changedFiles: ChangedFile[]): Promise<FileContext[]> {
    const results: FileContext[] = [];
    const seenPaths = new Set(changedFiles.map((f) => f.filename));

    for (const file of changedFiles) {
      // Find sibling files (same directory, same extension)
      const siblings = await this.findSiblingFiles(file.filename, seenPaths);
      results.push(...siblings);

      // Add sibling paths to seen set
      for (const sibling of siblings) {
        seenPaths.add(sibling.path);
      }
    }

    // Limit to avoid token overflow
    return results.slice(0, 5);
  }

  private async findSiblingFiles(
    filePath: string,
    exclude: Set<string>
  ): Promise<FileContext[]> {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const results: FileContext[] = [];

    try {
      const pattern = `${dir}/*${ext}`;
      const siblings = await this.platform.getFilesInDirectory(dir, pattern);

      for (const siblingPath of siblings.slice(0, 2)) {
        if (exclude.has(siblingPath) || siblingPath === filePath) {
          continue;
        }

        const content = await this.platform.getFileContent(siblingPath);

        if (content) {
          results.push({
            path: siblingPath,
            content: this.truncateForContext(content),
            role: 'sibling',
          });
        }
      }
    } catch (error) {
      core.debug(`Failed to find siblings for ${filePath}: ${error}`);
    }

    return results;
  }

  private buildDiff(files: ChangedFile[]): string {
    const parts: string[] = [];

    for (const file of files) {
      if (file.patch) {
        parts.push(`diff --git a/${file.filename} b/${file.filename}`);
        parts.push(file.patch);
      }
    }

    return parts.join('\n');
  }

  private truncateForContext(content: string, maxLines = 100): string {
    const lines = content.split('\n');

    if (lines.length <= maxLines) {
      return content;
    }

    return `${lines.slice(0, maxLines).join('\n')}\n... (truncated, ${lines.length - maxLines} more lines)`;
  }
}
