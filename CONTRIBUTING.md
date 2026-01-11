# Contributing to Code Sentinel

Thank you for your interest in contributing to Code Sentinel! This guide will help you get started.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Running Tests](#running-tests)
- [Code Style](#code-style)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0

### Setup

1. Fork the repository on GitHub
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/code-sentinel.git
   cd code-sentinel
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Available Scripts

```bash
# Build the project
npm run build

# Build in watch mode (for development)
npm run build:watch

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage

# Type check
npm run typecheck

# Lint code
npm run lint

# Fix lint issues
npm run lint:fix

# Format code
npm run format
```

### Development Process

1. Make your changes in the `src/` directory
2. Add or update tests in `*.test.ts` files
3. Run `npm run typecheck` to ensure type safety
4. Run `npm test` to verify all tests pass
5. Run `npm run lint` to check code style
6. Build with `npm run build` to verify the bundle

## Running Tests

We use [Vitest](https://vitest.dev/) for testing.

### Run all tests

```bash
npm test
```

### Run tests in watch mode

```bash
npm run test:watch
```

### Run tests with coverage

```bash
npm test -- --coverage
```

Coverage reports are generated in the `coverage/` directory.

### Run a specific test file

```bash
npm test -- src/config/schema.test.ts
```

### Test Structure

Tests are co-located with their source files:

```
src/
├── config/
│   ├── schema.ts
│   └── schema.test.ts      # Tests for schema.ts
├── engine/
│   ├── context.ts
│   └── context.test.ts     # Tests for context.ts
└── output/
    ├── formatter.ts
    └── formatter.test.ts   # Tests for formatter.ts
```

### Writing Tests

```typescript
import { describe, it, expect, vi } from 'vitest';
import { myFunction } from './myModule.js';

describe('myFunction', () => {
  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });

  it('should handle edge cases', () => {
    expect(() => myFunction(null)).toThrow();
  });
});
```

## Code Style

We use [Biome](https://biomejs.dev/) for linting and formatting.

### Rules

- Use single quotes for strings
- Use semicolons
- 2-space indentation
- Max line length: 100 characters
- Prefer `const` over `let`
- Use TypeScript strict mode

### Auto-fix

```bash
npm run lint:fix
npm run format
```

### Pre-commit

Run these commands before committing:

```bash
npm run typecheck
npm run lint
npm test
```

## Pull Request Process

### Before Submitting

1. Ensure all tests pass: `npm test`
2. Ensure type check passes: `npm run typecheck`
3. Ensure linting passes: `npm run lint`
4. Update documentation if needed
5. Add tests for new features

### PR Guidelines

- Use a clear, descriptive title
- Reference any related issues
- Describe what changes were made and why
- Include screenshots for UI changes
- Keep PRs focused on a single change

### PR Title Format

```
feat: add new feature
fix: resolve bug in X
docs: update README
test: add tests for Y
refactor: improve Z
chore: update dependencies
```

### Review Process

1. All PRs require at least one review
2. CI must pass (lint, typecheck, tests, build)
3. Address review feedback
4. Squash commits if requested

## Project Structure

```
code-sentinel/
├── src/
│   ├── config/         # Configuration schema and loading
│   ├── platforms/      # Platform adapters (GitHub, GitLab, etc.)
│   ├── llm/            # LLM provider implementations
│   ├── engine/         # Review engine and context collection
│   ├── prompts/        # LLM prompt templates
│   ├── output/         # Output formatting
│   └── index.ts        # Entry point
├── .github/
│   └── workflows/      # CI/CD workflows
├── dist/               # Built output (generated)
├── coverage/           # Test coverage (generated)
├── action.yml          # GitHub Action definition
├── package.json
├── tsconfig.json
├── biome.json
└── vitest.config.ts
```

## Adding New Features

### Adding a New LLM Provider

1. Create `src/llm/newprovider.ts` implementing `LLMProvider` interface
2. Add to factory in `src/llm/factory.ts`
3. Update schema in `src/config/schema.ts`
4. Add tests in `src/llm/newprovider.test.ts`
5. Update README with usage instructions

### Adding a New Platform

1. Create `src/platforms/newplatform/adapter.ts` implementing `PlatformAdapter`
2. Export from `src/platforms/index.ts`
3. Add tests for the new adapter
4. Update README with platform-specific instructions

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Check existing issues before creating new ones

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Follow the [Contributor Covenant](https://www.contributor-covenant.org/)

---

Thank you for contributing to Code Sentinel!
