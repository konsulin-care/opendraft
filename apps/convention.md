# apps/ — Conventions

## TypeScript (web/)

```typescript
// Strict mode required
// Use import type for type-only imports
import type { Manuscript } from '@opendraft/metadata';

// No `any` — use `unknown` and narrow
function process(data: unknown) { /* ... */ }

// Max 300 lines per file
// kebab-case filenames: manuscript-editor.ts
```

## Go (bff/)

```go
// Prefer standard library
// Minimize external dependencies
// Stateless handlers
// Max 300 lines per file
```

## PWA Patterns

- Use IndexedDB for all persistent storage.
- Register service workers in main.ts.
- Handle offline gracefully — show cached state.

## Error Handling

- TypeScript: Result<T, E> pattern or throw with typed errors.
- Go: return errors, don't panic.
- Log errors with context, never log secrets.

## File Naming

- TypeScript: `kebab-case.ts`
- Go: `camelCase.go` (standard)
- Test files: `*.test.ts`, `*_test.go`
