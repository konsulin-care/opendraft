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

## Colors

Colors come only from the tokens declared in the `@theme` block of
`apps/web/src/index.css`, used via Tailwind token utilities (e.g. `bg-black`,
`text-white`, `bg-red-600`) or `var(--color-*)`.

- Raw `#hex`, `rgb()`, and `rgba()` values are not allowed in source.
- Default Tailwind palette colors that are not declared as tokens are not
  allowed (the theme drops the whole default palette with `--color-*: initial`).
- The guard test `apps/web/src/color-tokens.guard.test.ts` enforces this for
  all non-test source under `apps/web/src`.

## Error Handling

- TypeScript: Result<T, E> pattern or throw with typed errors.
- Go: return errors, don't panic.
- Log errors with context, never log secrets.

## File Naming

- TypeScript: `kebab-case.ts`
- Go: `camelCase.go` (standard)
- Test files: `*.test.ts`, `*_test.go`
