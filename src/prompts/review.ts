
import type { ReviewRequest, FileContext } from '../llm/types.js';

export function getSystemPrompt(): string {
  return `You are Code Sentinel, an expert AI code reviewer. Your role is to analyze pull request changes and provide actionable, high-quality feedback focused on:

1. **Security**: Identify vulnerabilities like SQL injection, XSS, hardcoded secrets, insecure authentication, and OWASP Top 10 issues.

2. **Architecture**: Spot SOLID violations, improper layer dependencies, circular imports, missing abstractions, and inconsistent patterns.

3. **Performance**: Find N+1 queries, memory leaks, unnecessary re-renders, blocking operations, and inefficient algorithms.

4. **Bugs**: Detect logic errors, null pointer risks, edge cases, race conditions, and error handling gaps.

5. **Best Practices**: Note code style inconsistencies, missing error handling, and deviations from team conventions.

## Guidelines

- Focus on substantive issues, not style nitpicks (unless they affect readability significantly)
- Consider the context of the codebase and team conventions provided
- Provide specific, actionable suggestions with code examples when helpful
- Reference line numbers when possible for inline comments
- Be constructive and educational in tone
- Prioritize issues by severity: critical > warning > suggestion > nitpick

## Response Format

You MUST respond with valid JSON matching this structure:

{
  "summary": "Brief overview of the changes and assessment",
  "effortScore": 1-5,
  "issues": [
    {
      "severity": "critical|warning|suggestion|nitpick",
      "category": "security|architecture|performance|best-practices|bugs",
      "file": "path/to/file.ts",
      "line": 42,
      "title": "Short issue title",
      "description": "Detailed explanation of the issue",
      "suggestion": "How to fix it (optional)",
      "codeBlock": "suggested code fix (optional)"
    }
  ]
}`;
}

export function buildReviewPrompt(request: ReviewRequest): string {
  const sections: string[] = [];

  // PR Information
  sections.push(`## Pull Request
**Title:** ${request.pr.title}
**Author:** ${request.pr.author}
${request.pr.body ? `**Description:**\n${request.pr.body}` : ''}`);

  // Codebase Context
  if (request.context.conventions || request.context.instructions.length > 0) {
    sections.push('## Codebase Context');

    if (request.context.stack) {
      sections.push(`**Technology Stack:** ${request.context.stack.frameworks.join(', ')}`);
    }

    if (request.context.conventions) {
      sections.push(`### Team Conventions (from CLAUDE.md)\n${truncate(request.context.conventions, 2000)}`);
    }

    if (request.context.instructions.length > 0) {
      sections.push(`### Custom Instructions\n${request.context.instructions.map((i) => `- ${i}`).join('\n')}`);
    }
  }

  // Team Patterns
  if (request.context.patterns.length > 0) {
    const patternLines = request.context.patterns.map(
      (p) => `- **${p.category}**: ${p.pattern}`
    );
    sections.push(`### Team Patterns\n${patternLines.join('\n')}`);
  }

  // Related Files (for pattern reference)
  if (request.relatedFiles.length > 0) {
    sections.push('## Related Files (for pattern reference)');

    for (const file of request.relatedFiles.slice(0, 3)) {
      const excerpt = truncate(file.content, 1000);
      sections.push(`### ${file.path} (${file.role})\n\`\`\`\n${excerpt}\n\`\`\``);
    }
  }

  // Changed Files with full content
  sections.push('## Changed Files');

  for (const file of request.changedFiles) {
    sections.push(`### ${file.path}\n\`\`\`\n${truncate(file.content, 3000)}\n\`\`\``);
  }

  // Diff
  sections.push(`## Diff\n\`\`\`diff\n${truncate(request.diff, 8000)}\n\`\`\``);

  // Review Categories
  sections.push(`## Focus Areas
Please focus your review on these categories: ${request.categories.join(', ')}`);

  // Instructions
  sections.push(`## Instructions
Review the code changes above. Consider:
1. The team's established conventions and patterns
2. Consistency with related files shown
3. Security, performance, and correctness concerns
4. Best practices for the technology stack

Return your analysis as JSON.`);

  return sections.join('\n\n');
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.substring(0, maxLength)}\n... (truncated, ${text.length - maxLength} more characters)`;
}

export function formatFileContext(files: FileContext[]): string {
  if (files.length === 0) {
    return 'No related files found.';
  }

  return files
    .map((f) => {
      const lines = f.content.split('\n');
      const preview = lines.slice(0, 30).join('\n');

      return `### ${f.path}\n\`\`\`\n${preview}${lines.length > 30 ? '\n... (truncated)' : ''}\n\`\`\``;
    })
    .join('\n\n');
}
