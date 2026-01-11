
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as core from '@actions/core';
import { parse as parseYaml } from 'yaml';
import { type SentinelConfig, SentinelConfigSchema, defaultConfig } from './schema.js';

export interface LoadedConfig {
  config: SentinelConfig;
  claudeMdContent?: string;
}

export async function loadConfig(configPath: string, workingDir: string): Promise<LoadedConfig> {
  let config = defaultConfig;

  // Try to load .sentinel.yml
  const fullConfigPath = path.isAbsolute(configPath)
    ? configPath
    : path.join(workingDir, configPath);

  if (fs.existsSync(fullConfigPath)) {
    try {
      const content = fs.readFileSync(fullConfigPath, 'utf-8');
      const parsed = parseYaml(content);
      config = SentinelConfigSchema.parse(parsed);
      core.info(`Loaded config from ${fullConfigPath}`);
    } catch (error) {
      core.warning(`Failed to parse config file: ${error}`);
      core.info('Using default configuration');
    }
  } else {
    core.info(`No config file found at ${fullConfigPath}, using defaults`);
  }

  // Try to load CLAUDE.md if enabled
  let claudeMdContent: string | undefined;

  if (config.claude_md.enabled) {
    const claudeMdPath = config.claude_md.path
      ? path.join(workingDir, config.claude_md.path)
      : findClaudeMd(workingDir);

    if (claudeMdPath && fs.existsSync(claudeMdPath)) {
      try {
        claudeMdContent = fs.readFileSync(claudeMdPath, 'utf-8');
        core.info(`Loaded CLAUDE.md from ${claudeMdPath}`);
      } catch (error) {
        core.warning(`Failed to read CLAUDE.md: ${error}`);
      }
    }
  }

  return { config, claudeMdContent };
}

function findClaudeMd(workingDir: string): string | undefined {
  const possiblePaths = [
    path.join(workingDir, 'CLAUDE.md'),
    path.join(workingDir, '.claude', 'CLAUDE.md'),
    path.join(workingDir, 'docs', 'CLAUDE.md'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return undefined;
}

export function mergeWithActionInputs(config: SentinelConfig): SentinelConfig {
  const openaiApiKey = core.getInput('openai_api_key');
  const openaiModel = core.getInput('openai_model');
  const ollamaBaseUrl = core.getInput('ollama_base_url');
  const ollamaModel = core.getInput('ollama_model');

  // Determine provider based on available credentials
  let provider = config.llm.provider;

  if (openaiApiKey && !ollamaBaseUrl) {
    provider = 'openai';
  } else if (!openaiApiKey && ollamaBaseUrl) {
    provider = 'ollama';
  }

  return {
    ...config,
    llm: {
      ...config.llm,
      provider,
      model: provider === 'openai' ? (openaiModel || config.llm.model) : (ollamaModel || config.llm.model),
      base_url: ollamaBaseUrl || config.llm.base_url,
    },
  };
}
