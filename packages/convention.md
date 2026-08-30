# packages/ — Conventions

## Package Structure

```text
packages/{name}/
├── src/
│   ├── index.ts         # Public API
│   ├── types.ts         # TypeScript interfaces
│   └── {module}.ts      # Implementation
├── tests/
│   └── {module}.test.ts
├── package.json
└── tsconfig.json
```

## Exports

```typescript
// index.ts — named exports only
export { parseManuscript } from './src/parser.js';
export type { Manuscript, ManuscriptConfig } from './src/types.js';
```

## Dependency Rules

- No circular dependencies between packages.
- No dependencies on apps/ — only other packages.
- Use workspace protocol: `"@opendraft/git": "workspace:*"`.

## Versioning

- Packages share the monorepo version.
- No independent versioning in MVP.
- Breaking changes require ADR.

## Testing

- Unit tests for all public functions.
- Test file co-located in tests/ directory.
- Use descriptive test names: `parseManuscript handles empty frontmatter`.
