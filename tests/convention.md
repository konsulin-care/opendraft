# tests/ — Conventions

## Test File Naming

```text
tests/conformance/{category}/{requirement-id}.test.ts
tests/conformance/article/title-required.test.ts
tests/conformance/registry/has-publications.test.ts
```

## Assertion Patterns

```typescript
// Test protocol-level requirements
describe('Article SHACL', () => {
  it('requires title', () => {
    const article = { /* missing title */ };
    const violations = validate(article, articleShapes);
    expect(violations).toContain('title required');
  });
});
```

## Fixture Management

```text
tests/conformance/fixtures/
├── valid-article.ttl
├── invalid-article-missing-title.ttl
├── valid-registry.ttl
└── ...
```

- Fixtures are static files, not generated.
- Name fixtures by what they represent.
- Keep fixtures minimal — only required fields.

## Running Tests

```bash
# All conformance tests
npm test

# Specific category
npm test -- --grep "Article SHACL"

# Watch mode
npm test -- --watch
```
