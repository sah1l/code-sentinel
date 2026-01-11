
import * as core from '@actions/core';
import type { SentinelConfig } from '../config/schema.js';
import type { PlatformAdapter, PullRequest } from '../platforms/types.js';
import type { LLMProvider, ReviewRequest, ReviewResponse, ReviewIssue } from '../llm/types.js';
import { ContextCollector } from './context.js';

export interface AnalysisResult {
  response: ReviewResponse;
  filteredIssues: ReviewIssue[];
  skipped: boolean;
  skipReason?: string;
}

export class ReviewAnalyzer {
  private contextCollector: ContextCollector;

  constructor(
    platform: PlatformAdapter,
    private llmProvider: LLMProvider,
    private config: SentinelConfig,
    claudeMdContent?: string
  ) {
    this.contextCollector = new ContextCollector(platform, config, claudeMdContent);
  }

  async analyze(pr: PullRequest): Promise<AnalysisResult> {
    // Check if PR should be skipped based on author
    if (this.config.ignore.authors.includes(pr.author)) {
      return {
        response: this.emptyResponse(),
        filteredIssues: [],
        skipped: true,
        skipReason: `PR author ${pr.author} is in ignore list`,
      };
    }

    // Collect context
    const context = await this.contextCollector.collect(pr);

    if (context.changedFiles.length === 0) {
      return {
        response: this.emptyResponse(),
        filteredIssues: [],
        skipped: true,
        skipReason: 'No reviewable files in PR',
      };
    }

    // Build review request
    const request: ReviewRequest = {
      pr: {
        title: pr.title,
        body: pr.body,
        author: pr.author,
      },
      diff: context.diff,
      changedFiles: context.changedFiles,
      relatedFiles: context.relatedFiles,
      context: context.reviewContext,
      categories: this.config.review.categories,
    };

    // Get LLM analysis
    core.info(`Analyzing PR with ${this.llmProvider.name}...`);
    const response = await this.llmProvider.analyze(request);

    // Check effort threshold
    if (response.effortScore < this.config.review.skip_if_effort_below) {
      return {
        response,
        filteredIssues: [],
        skipped: true,
        skipReason: `PR effort score (${response.effortScore}) below threshold (${this.config.review.skip_if_effort_below})`,
      };
    }

    // Filter issues by severity
    const filteredIssues = this.filterBySeverity(response.issues);

    return {
      response,
      filteredIssues,
      skipped: false,
    };
  }

  private filterBySeverity(issues: ReviewIssue[]): ReviewIssue[] {
    const severityOrder = ['critical', 'warning', 'suggestion', 'nitpick'];
    const minIndex = severityOrder.indexOf(this.config.review.min_severity);

    return issues.filter((issue) => {
      const issueIndex = severityOrder.indexOf(issue.severity);
      return issueIndex <= minIndex;
    });
  }

  private emptyResponse(): ReviewResponse {
    return {
      summary: 'No issues found.',
      effortScore: 1,
      issues: [],
    };
  }
}
