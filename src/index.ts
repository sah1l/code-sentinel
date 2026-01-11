
import * as core from '@actions/core';
import { loadConfig, mergeWithActionInputs } from './config/index.js';
import { GitHubAdapter } from './platforms/index.js';
import { createLLMProvider } from './llm/index.js';
import { ReviewAnalyzer } from './engine/index.js';
import { OutputFormatter } from './output/index.js';

async function run(): Promise<void> {
  try {
    core.info('Code Sentinel - AI-powered code review');
    core.info('=====================================');

    // Get inputs
    const githubToken = core.getInput('github_token', { required: true });
    const configPath = core.getInput('config_path') || '.sentinel.yml';
    const dryRun = core.getInput('dry_run') === 'true';
    const workingDir = process.env.GITHUB_WORKSPACE || process.cwd();

    // Load configuration
    core.info('Loading configuration...');
    const { config: baseConfig, claudeMdContent } = await loadConfig(configPath, workingDir);
    const config = mergeWithActionInputs(baseConfig);

    core.info(`LLM Provider: ${config.llm.provider}`);
    core.info(`Review categories: ${config.review.categories.join(', ')}`);

    // Initialize platform adapter
    const platform = new GitHubAdapter(githubToken, workingDir);

    // Get PR information
    core.info('Fetching pull request information...');
    const pr = await platform.getPullRequest();
    core.info(`Reviewing PR #${pr.id}: ${pr.title}`);
    core.info(`Files changed: ${pr.files.length}`);

    // Initialize LLM provider
    const llmProvider = createLLMProvider(config);

    // Analyze the PR
    const analyzer = new ReviewAnalyzer(platform, llmProvider, config, claudeMdContent);
    const result = await analyzer.analyze(pr);

    if (result.skipped) {
      core.info(`Review skipped: ${result.skipReason}`);
      core.setOutput('summary', result.skipReason);
      core.setOutput('issues_count', 0);
      core.setOutput('critical_count', 0);
      core.setOutput('warning_count', 0);
      core.setOutput('effort_score', result.response.effortScore);
      return;
    }

    // Format output
    const formatter = new OutputFormatter(config, llmProvider.name);
    const output = formatter.format(result.response, result.filteredIssues);

    // Set outputs
    core.setOutput('summary', result.response.summary);
    core.setOutput('issues_count', result.filteredIssues.length);
    core.setOutput(
      'critical_count',
      result.filteredIssues.filter((i) => i.severity === 'critical').length
    );
    core.setOutput(
      'warning_count',
      result.filteredIssues.filter((i) => i.severity === 'warning').length
    );
    core.setOutput('effort_score', result.response.effortScore);

    if (dryRun) {
      core.info('Dry run mode - not posting comments');
      core.info('--- Review Summary ---');
      core.info(output.summary);
      return;
    }

    // Post review to PR
    if (config.output.summary) {
      core.info('Posting review summary...');
      await platform.postReviewSummary(output.summary);
    }

    if (config.output.inline_comments && output.inlineComments.length > 0) {
      core.info(`Posting ${output.inlineComments.length} inline comments...`);
      await platform.postInlineComments(output.inlineComments);
    }

    if (config.output.labels.enabled && output.labels.length > 0 && platform.addLabels) {
      core.info(`Adding labels: ${output.labels.join(', ')}`);
      await platform.addLabels(output.labels);
    }

    // Log summary
    core.info('');
    core.info('Review completed!');
    core.info(`  Issues found: ${result.filteredIssues.length}`);
    core.info(`  Effort score: ${result.response.effortScore}/5`);

    // Set exit status based on critical issues
    const criticalCount = result.filteredIssues.filter((i) => i.severity === 'critical').length;

    if (criticalCount > 0) {
      core.warning(`Found ${criticalCount} critical issue(s) that should be addressed.`);
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
      core.error(error.stack || '');
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

run();
