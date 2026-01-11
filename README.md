# Code Sentinel

AI-powered code review GitHub Action that learns your team's patterns and focuses on security, architecture, and performance.

[![CI](https://github.com/sah1l/code-sentinel/actions/workflows/ci.yml/badge.svg)](https://github.com/sah1l/code-sentinel/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

## Features

- **Multiple LLM Providers**: OpenAI GPT-4o or self-hosted Ollama (CodeLlama, DeepSeek, etc.)
- **Context-Aware Reviews**: Understands your codebase patterns from CLAUDE.md and .sentinel.yml
- **Focused Feedback**: Security, architecture, performance, and bug detection
- **Pattern Learning**: Define team conventions and get consistent reviews
- **Privacy-First**: Use Ollama for fully local, private code reviews
- **Inline Comments**: Posts comments directly on the relevant lines

## Quick Start

### Using OpenAI

```yaml
# .github/workflows/code-review.yml
name: Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: AI Code Review
        uses: sah1l/code-sentinel@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          openai_api_key: ${{ secrets.OPENAI_API_KEY }}
```

### Using Ollama (Self-hosted)

```yaml
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Start Ollama
        run: |
          curl -fsSL https://ollama.ai/install.sh | sh
          ollama serve &
          sleep 5
          ollama pull codellama:13b

      - name: AI Code Review
        uses: sah1l/code-sentinel@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          ollama_base_url: http://localhost:11434
          ollama_model: codellama:13b
```

## Configuration

Create a `.sentinel.yml` file in your repository root:

```yaml
# LLM Configuration
llm:
  provider: openai  # openai | ollama
  model: gpt-4o

# Review Focus Areas
review:
  categories:
    - security
    - architecture
    - performance
    - bugs
  min_severity: suggestion  # critical | warning | suggestion | nitpick

# Files to ignore
ignore:
  paths:
    - "**/*.test.ts"
    - "**/*.spec.ts"
    - "docs/**"
    - "*.md"
  authors:
    - dependabot[bot]

# Team conventions (fed into the prompt)
instructions:
  - "We use file-scoped namespaces in C#"
  - "Always use async/await instead of .then()"
  - "Controllers should only call services, never repositories directly"

# Defined patterns for consistency checks
patterns:
  - category: naming
    pattern: "Use PascalCase for classes, camelCase for variables"
  - category: architecture
    pattern: "Feature-based folder organization"

# Output configuration
output:
  summary: true
  inline_comments: true
  max_inline_comments: 15
  labels:
    enabled: true
    security_issue: "security"
    effort_prefix: "effort:"
```

## CLAUDE.md Integration

Code Sentinel automatically reads your `CLAUDE.md` file to understand team conventions:

```markdown
# CLAUDE.md

## Coding Conventions
- Use file-scoped namespaces
- Prefer primary constructors
- Always include error handling

## Architecture
- Feature-based folder organization
- Repository pattern for data access
```

## Action Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github_token` | GitHub token for API access | Yes | - |
| `openai_api_key` | OpenAI API key | No | - |
| `openai_model` | OpenAI model to use | No | `gpt-4o` |
| `ollama_base_url` | Ollama server URL | No | `http://localhost:11434` |
| `ollama_model` | Ollama model to use | No | `codellama:13b` |
| `config_path` | Path to .sentinel.yml | No | `.sentinel.yml` |
| `dry_run` | Don't post comments | No | `false` |

## Action Outputs

| Output | Description |
|--------|-------------|
| `summary` | Review summary text |
| `issues_count` | Total issues found |
| `critical_count` | Critical issues count |
| `warning_count` | Warning count |
| `effort_score` | Review effort (1-5) |

## Review Categories

### Security
- SQL injection, XSS, CSRF vulnerabilities
- Hardcoded secrets and credentials
- Insecure authentication patterns
- OWASP Top 10 issues

### Architecture
- SOLID principle violations
- Circular dependencies
- Layer violations
- Missing abstractions

### Performance
- N+1 query patterns
- Memory leaks
- Unnecessary re-renders
- Blocking operations

### Bugs
- Logic errors
- Null pointer risks
- Edge cases
- Race conditions

## Example Output

### Summary Comment

```markdown
## Code Sentinel Review

**Review Effort:** ★★★☆☆ (3/5)

### Summary
This PR adds user authentication with JWT tokens. Good implementation with a few security considerations.

### Issues Found

#### Critical (1)
- **Hardcoded Secret** in `src/auth/jwt.ts:15` - JWT secret should not be hardcoded

#### Warnings (2)
- **Missing Input Validation** in `src/auth/login.ts:23` - Email not validated before query
- **N+1 Query** in `src/users/list.ts:45` - Consider eager loading roles
```

### Inline Comment

Code Sentinel posts inline comments directly on the problematic lines:

```
🔴 **SQL Injection Risk**

This query concatenates user input directly into the SQL string.

**Suggestion:** Use parameterized queries instead.
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Lint
npm run lint

# Type check
npm run typecheck
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on:

- Setting up the development environment
- Running tests
- Code style guidelines
- Pull request process

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Built with [TypeScript](https://www.typescriptlang.org/)
- LLM integrations via [OpenAI](https://openai.com/) and [Ollama](https://ollama.ai/)
- Inspired by [PR-Agent](https://github.com/qodo-ai/pr-agent) and [CodeRabbit](https://coderabbit.ai/)

---

**Code Sentinel** is free and open source. [Star us on GitHub](https://github.com/sah1l/code-sentinel) if you find it useful.
