import * as fs from 'node:fs';
import * as path from 'node:path';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { minimatch } from 'minimatch';
import type { ChangedFile, PlatformAdapter, PullRequest, ReviewComment } from '../types.js';
import { parsePatch, findNearestValidLine, type ParsedDiff } from './diff-parser.js';

type Octokit = ReturnType<typeof github.getOctokit>;

export class GitHubAdapter implements PlatformAdapter {
  readonly name = 'github';
  private octokit: Octokit;
  private context: typeof github.context;
  private workingDir: string;
  /** Map of file path to parsed diff for validating comment line numbers */
  private fileDiffs: Map<string, ParsedDiff> = new Map();

  constructor(token: string, workingDir: string = process.cwd()) {
    this.octokit = github.getOctokit(token);
    this.context = github.context;
    this.workingDir = workingDir;
  }

  async getPullRequest(): Promise<PullRequest> {
    const prNumber = this.context.payload.pull_request?.number;

    if (!prNumber) {
      throw new Error('This action must be run on a pull_request event');
    }

    const { data: pr } = await this.octokit.rest.pulls.get({
      ...this.context.repo,
      pull_number: prNumber,
    });

    const { data: files } = await this.octokit.rest.pulls.listFiles({
      ...this.context.repo,
      pull_number: prNumber,
      per_page: 100,
    });

    const changedFiles: ChangedFile[] = files.map((f) => {
      // Parse and store the diff for each file for later comment validation
      if (f.patch) {
        this.fileDiffs.set(f.filename, parsePatch(f.patch));
      }
      return {
        filename: f.filename,
        status: f.status as ChangedFile['status'],
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch,
        previousFilename: f.previous_filename,
      };
    });

    return {
      id: prNumber,
      title: pr.title,
      body: pr.body || '',
      author: pr.user?.login || 'unknown',
      baseBranch: pr.base.ref,
      headBranch: pr.head.ref,
      baseRef: pr.base.sha,
      headRef: pr.head.sha,
      files: changedFiles,
    };
  }

  async getFileContent(filePath: string, ref?: string): Promise<string | null> {
    // First try to read from local filesystem (faster)
    const localPath = path.join(this.workingDir, filePath);

    if (fs.existsSync(localPath)) {
      try {
        return fs.readFileSync(localPath, 'utf-8');
      } catch (error) {
        core.debug(`Failed to read local file ${localPath}: ${error}`);
      }
    }

    // Fallback to GitHub API
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        ...this.context.repo,
        path: filePath,
        ref: ref || this.context.sha,
      });

      if ('content' in data && data.encoding === 'base64') {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }

      return null;
    } catch (error) {
      core.debug(`Failed to fetch file ${filePath} from GitHub: ${error}`);
      return null;
    }
  }

  async getFilesInDirectory(directory: string, pattern?: string): Promise<string[]> {
    const dirPath = path.join(this.workingDir, directory);
    const results: string[] = [];

    if (!fs.existsSync(dirPath)) {
      return results;
    }

    const scanDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(this.workingDir, fullPath);

        if (entry.isDirectory()) {
          // Skip common non-code directories
          if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
            scanDir(fullPath);
          }
        } else if (entry.isFile()) {
          if (!pattern || minimatch(relativePath, pattern)) {
            results.push(relativePath);
          }
        }
      }
    };

    try {
      scanDir(dirPath);
    } catch (error) {
      core.debug(`Failed to scan directory ${directory}: ${error}`);
    }

    return results;
  }

  async postReviewSummary(summary: string): Promise<void> {
    const prNumber = this.context.payload.pull_request?.number;

    if (!prNumber) {
      throw new Error('No pull request number found');
    }

    await this.octokit.rest.pulls.createReview({
      ...this.context.repo,
      pull_number: prNumber,
      body: summary,
      event: 'COMMENT',
    });

    core.info('Posted review summary to PR');
  }

  async postInlineComments(comments: ReviewComment[]): Promise<void> {
    const prNumber = this.context.payload.pull_request?.number;

    if (!prNumber) {
      throw new Error('No pull request number found');
    }

    if (comments.length === 0) {
      core.info('No inline comments to post');
      return;
    }

    // Get the latest commit SHA for the PR
    const { data: pr } = await this.octokit.rest.pulls.get({
      ...this.context.repo,
      pull_number: prNumber,
    });

    // Validate and filter comments to only include lines in the diff
    const validComments: { path: string; line: number; body: string; side: string }[] = [];
    let skippedCount = 0;

    for (const comment of comments) {
      const parsedDiff = this.fileDiffs.get(comment.path);

      if (!parsedDiff) {
        // No diff info available - skip this comment
        core.debug(`Skipping comment on ${comment.path}:${comment.line} - no diff info`);
        skippedCount++;
        continue;
      }

      // Try to find a valid line (exact match or nearby)
      const validLine = findNearestValidLine(comment.line, parsedDiff, 3);

      if (validLine === undefined) {
        core.debug(
          `Skipping comment on ${comment.path}:${comment.line} - line not in diff`
        );
        skippedCount++;
        continue;
      }

      // Adjust body if line was shifted
      let body = comment.body;
      if (validLine !== comment.line) {
        body = `*(Note: Originally for line ${comment.line})*\n\n${comment.body}`;
      }

      validComments.push({
        path: comment.path,
        line: validLine,
        body,
        side: comment.side,
      });
    }

    if (skippedCount > 0) {
      core.warning(
        `Skipped ${skippedCount} comment(s) - line numbers not in PR diff`
      );
    }

    if (validComments.length === 0) {
      core.info('No valid inline comments to post (all lines were outside the diff)');
      return;
    }

    await this.octokit.rest.pulls.createReview({
      ...this.context.repo,
      pull_number: prNumber,
      commit_id: pr.head.sha,
      event: 'COMMENT',
      comments: validComments,
    });

    core.info(`Posted ${validComments.length} inline comments to PR`);
  }

  async addLabels(labels: string[]): Promise<void> {
    const prNumber = this.context.payload.pull_request?.number;

    if (!prNumber) {
      throw new Error('No pull request number found');
    }

    if (labels.length === 0) {
      return;
    }

    await this.octokit.rest.issues.addLabels({
      ...this.context.repo,
      issue_number: prNumber,
      labels,
    });

    core.info(`Added labels: ${labels.join(', ')}`);
  }
}
