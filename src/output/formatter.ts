
import type { SentinelConfig } from '../config/schema.js';
import type { ReviewResponse, ReviewIssue } from '../llm/types.js';
import type { ReviewComment } from '../platforms/types.js';

export interface FormattedOutput {
  summary: string;
  inlineComments: ReviewComment[];
  labels: string[];
}

export class OutputFormatter {
  constructor(
    private config: SentinelConfig,
    private llmProviderName: string
  ) { }

  format(response: ReviewResponse, filteredIssues: ReviewIssue[]): FormattedOutput {
    const summary = this.formatSummary(response, filteredIssues);
    const inlineComments = this.formatInlineComments(filteredIssues);
    const labels = this.generateLabels(response, filteredIssues);

    return { summary, inlineComments, labels };
  }

  private formatSummary(response: ReviewResponse, issues: ReviewIssue[]): string {
    const lines: string[] = [];

    // Header
    lines.push('## Code Sentinel Review');
    lines.push('');

    // Effort Score
    const stars = this.getStars(response.effortScore);
    lines.push(`**Review Effort:** ${stars} (${response.effortScore}/5)`);
    lines.push('');

    // Summary
    lines.push('### Summary');
    lines.push(response.summary);
    lines.push('');

    // Issues breakdown
    if (issues.length > 0) {
      lines.push('### Issues Found');
      lines.push('');

      const criticalIssues = issues.filter((i) => i.severity === 'critical');
      const warningIssues = issues.filter((i) => i.severity === 'warning');
      const suggestionIssues = issues.filter((i) => i.severity === 'suggestion');
      const nitpickIssues = issues.filter((i) => i.severity === 'nitpick');

      if (criticalIssues.length > 0) {
        lines.push(`#### Critical (${criticalIssues.length})`);
        for (const issue of criticalIssues) {
          lines.push(this.formatIssueLine(issue));
        }
        lines.push('');
      }

      if (warningIssues.length > 0) {
        lines.push(`#### Warnings (${warningIssues.length})`);
        for (const issue of warningIssues) {
          lines.push(this.formatIssueLine(issue));
        }
        lines.push('');
      }

      if (suggestionIssues.length > 0) {
        lines.push(`#### Suggestions (${suggestionIssues.length})`);
        for (const issue of suggestionIssues) {
          lines.push(this.formatIssueLine(issue));
        }
        lines.push('');
      }

      if (nitpickIssues.length > 0) {
        lines.push(`#### Nitpicks (${nitpickIssues.length})`);
        for (const issue of nitpickIssues) {
          lines.push(this.formatIssueLine(issue));
        }
        lines.push('');
      }
    } else {
      lines.push('No issues found. Great job!');
      lines.push('');
    }

    // Footer
    lines.push('---');
    lines.push(
      `<sub>Reviewed by [Code Sentinel](https://github.com/sah1l/code-sentinel) using ${this.llmProviderName}</sub>`
    );

    return lines.join('\n');
  }

  private formatIssueLine(issue: ReviewIssue): string {
    const location = issue.line ? `:${issue.line}` : '';
    return `- **${issue.title}** in \`${issue.file}${location}\` - ${issue.description}`;
  }

  private formatInlineComments(issues: ReviewIssue[]): ReviewComment[] {
    const comments: ReviewComment[] = [];
    const maxComments = this.config.output.max_inline_comments;

    // Only include issues that have line numbers
    const issuesWithLines = issues.filter((i) => i.line !== undefined);

    for (const issue of issuesWithLines.slice(0, maxComments)) {
      comments.push({
        path: issue.file,
        line: issue.line!,
        body: this.formatInlineComment(issue),
        side: 'RIGHT',
      });
    }

    return comments;
  }

  private formatInlineComment(issue: ReviewIssue): string {
    const severityIcon = this.getSeverityIcon(issue.severity);
    const lines: string[] = [];

    lines.push(`${severityIcon} **${issue.title}**`);
    lines.push('');
    lines.push(issue.description);

    if (issue.suggestion) {
      lines.push('');
      lines.push(`**Suggestion:** ${issue.suggestion}`);
    }

    if (issue.codeBlock) {
      lines.push('');
      lines.push('```');
      lines.push(issue.codeBlock);
      lines.push('```');
    }

    lines.push('');
    lines.push(`<sub>Category: ${issue.category} | Severity: ${issue.severity}</sub>`);

    return lines.join('\n');
  }

  private generateLabels(response: ReviewResponse, issues: ReviewIssue[]): string[] {
    if (!this.config.output.labels.enabled) {
      return [];
    }

    const labels: string[] = [];
    const labelConfig = this.config.output.labels;

    // Security label
    const hasSecurityIssue = issues.some(
      (i) => i.category === 'security' && (i.severity === 'critical' || i.severity === 'warning')
    );

    if (hasSecurityIssue) {
      labels.push(labelConfig.security_issue);
    }

    // Effort label
    labels.push(`${labelConfig.effort_prefix}${response.effortScore}`);

    return labels;
  }

  private getStars(score: number): string {
    return ''.repeat(score) + ''.repeat(5 - score);
  }

  private getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'critical':
        return '\u{1F534}'; // Red circle
      case 'warning':
        return '\u{1F7E1}'; // Yellow circle
      case 'suggestion':
        return '\u{1F4A1}'; // Light bulb
      case 'nitpick':
        return '\u{1F4DD}'; // Memo
      default:
        return '\u{2139}'; // Info
    }
  }
}
