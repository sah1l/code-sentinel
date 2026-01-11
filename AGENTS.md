# Code Sentinel - AI Agent Instructions

This file provides guidance for AI agents working on the Code Sentinel codebase.

## Project Overview

Code Sentinel is an AI-powered code review GitHub Action that:
- Supports multiple LLM providers (OpenAI, Anthropic, Gemini, Ollama)
- Learns team patterns from configuration and context files
- Posts inline review comments and summaries on pull requests
- Focuses on security, architecture, performance, and bugs

## Technology Stack

- **Language**: TypeScript 5.7+ with strict mode
- **Runtime**: Node.js 20+
- **Build**: esbuild (bundled for GitHub Actions)
- **Testing**: Vitest
- **Linting**: Biome
- **Package Manager**: npm

## Key Files

| File | Purpose |
|------|---------|
| `action.yml` | GitHub Action definition and inputs |
| `src/index.ts` | Action entry point |
| `src/llm/factory.ts` | LLM provider factory |
| `src/config/schema.ts` | Zod configuration schemas |
| `.sentinel.example.yml` | Example user configuration |

## Coding Conventions

### TypeScript Style

- **Use `type` imports**: Always use `import type` for type-only imports
  ```typescript
  // Good
  import type { SentinelConfig } from '../config/schema.js';
  import { createLLMProvider } from './factory.js';

  // Bad
  import { SentinelConfig } from '../config/schema.js';
  ```

- **Use `.js` extensions**: Always include `.js` extension in imports (ESM requirement)
  ```typescript
  // Good
  import { foo } from './bar.js';

  // Bad
  import { foo } from './bar';
  ```

- **Prefer `const` over `let`**: Use `const` by default, only use `let` when reassignment is needed

- **Use single quotes**: String literals should use single quotes
  ```typescript
  // Good
  const name = 'Code Sentinel';

  // Bad
  const name = "Code Sentinel";
  ```

- **Use semicolons**: Always include semicolons at end of statements

- **Trailing commas**: Use trailing commas in multi-line arrays/objects (ES5 style)

### Interface Design

- **Use `readonly` for provider name**: LLM providers should have `readonly name: string`
- **Return interfaces, not implementations**: Functions should return interface types
- **Use Zod for runtime validation**: All external data (configs, API responses) should be validated

### Error Handling

- **Throw descriptive errors**: Include context about what went wrong
  ```typescript
  // Good
  throw new Error('OpenAI API key is required. Set the openai_api_key input in your workflow.');

  // Bad
  throw new Error('Missing API key');
  ```

- **Use `core.warning` for non-fatal issues**: Don't fail the action for recoverable errors
- **Use `core.setFailed` for fatal errors**: End the action with a clear error message

### Testing

- **Test file naming**: Use `*.test.ts` suffix, co-located with source files
- **Use Vitest**: `describe`, `it`, `expect` from vitest
- **Mock external dependencies**: Use `vi.fn()` and `vi.mocked()` for mocks
- **Test edge cases**: Include tests for error conditions and boundary cases

### File Organization

- **One concept per file**: Each file should have a single responsibility
- **Group by feature**: Related code lives in the same directory
- **Export from index**: Use barrel exports sparingly, prefer direct imports

## Common Development Commands

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Fix lint issues
npm run lint:fix

# Type check
npm run typecheck

# Build action
npm run build

# Build in watch mode
npm run build:watch
```

## Adding a New LLM Provider

1. Create `src/llm/<provider>.ts` implementing `LLMProvider` interface
2. Add provider name to `LLMProviderSchema` in `src/config/schema.ts`
3. Add provider case in `src/llm/factory.ts`
4. Add action inputs in `action.yml`
5. Update `README.md` with usage example

## Key Patterns

### Provider Factory Pattern

```typescript
// All LLM providers implement the same interface
export interface LLMProvider {
  readonly name: string;
  analyze(request: ReviewRequest): Promise<ReviewResponse>;
}

// Factory creates the appropriate provider based on config
export function createLLMProvider(config: SentinelConfig): LLMProvider {
  switch (config.llm.provider) {
    case 'openai':
      return new OpenAIProvider(apiKey, model);
    // ... other providers
  }
}
```

### Zod Schema Validation

```typescript
// Define schema with defaults
export const ReviewConfigSchema = z.object({
  categories: z.array(ReviewCategorySchema).default(['security', 'architecture', 'bugs']),
  min_severity: SeveritySchema.default('suggestion'),
});

// Parse with validation
const config = SentinelConfigSchema.parse(rawConfig);
```

### Context Collection

```typescript
// ContextCollector gathers all relevant information for the review
const collector = new ContextCollector(platform, config, contextFiles);
const context = await collector.collect(pr);
// context contains: changedFiles, relatedFiles, diff, reviewContext
```

### Error Messages
```typescript
// Include actionable context in errors
throw new Error('OpenAI API key is required. Set the openai_api_key input in your workflow.');
```

### Configuration with Defaults
```typescript
// All config fields should have sensible defaults via Zod
export const ReviewConfigSchema = z.object({
  categories: z.array(ReviewCategorySchema).default(['security', 'architecture', 'bugs']),
});
```

## Git Workflow

- **Branch naming**: `feature/<description>` or `fix/<description>`
- **Commit messages**: Use conventional commits (`feat:`, `fix:`, `docs:`, etc.)
- **Don't push directly**: Always wait for explicit user instruction to push

## Security Considerations

- Never log or expose API keys
- Validate all external inputs with Zod
- Be careful with user-provided regex patterns
- Don't execute arbitrary code from PR content

## Don't Forget

- If making any actual code changes apart from docuents, run `npm test` to verify tests pass
- Run `npm run lint` to check code style, but only when any actual code changes are made
- Use `npm run build` to rebuild the dist folder, but only when any actual code changes are made
- All configuration fields must be optional with defaults
- New LLM providers need: implementation, schema update, factory case, action.yml inputs