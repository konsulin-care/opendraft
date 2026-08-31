# WORKFLOW.md — Git, PRs, CI/CD

## Branch Strategy

- **main** — stable, always deployable, protected.
- **Feature branches** — `feat/*`, `fix/*`, `docs/*`, `chore/*`.
- **No release branches** in MVP — main is the release.

## Commit Conventions

```text
feat: add new feature
fix: correct bug
refactor: restructure without behavior change
docs: documentation only
chore: maintenance, dependencies
test: add or update tests
```

Subject under 75 characters. Body explains what and why.

## Pull Request Process

1. Create branch from main.
2. Make changes, commit with conventional messages.
3. Pre-commit hooks run automatically.
4. Push branch (pre-push hooks run).
5. Open PR.
6. PR title matches commit convention.
7. PR description links related issues.
8. CI passes (lint, typecheck, test, build).
9. Squash merge into main.

## Git Hooks

Managed by lefthook (see ADR-017 for rationale).

### Pre-commit

Runs on every commit. Checks:

- TypeScript type-checking
- ESLint (with auto-fix)
- Go formatting and vetting
- Go mod tidy
- TTL validation
- Markdown linting
- YAML linting
- Large file check (max 300 lines)

### Pre-push

Runs before push to remote. Checks:

- Full test suite (pnpm + Go)
- Build validation (pnpm + Go)
- Go vulnerability scanning (govulncheck)
- Complexity analysis (cyclomatic ≤ 15)

### Bypassing Hooks

Use `--no-verify` to skip hooks. Bypassed hooks still run in CI.

## CI/CD Pipeline

GitHub Actions workflow in `.github/workflows/`:

1. Checkout source
2. Resolve pinned OpenDraft protocol
3. Validate metadata (SHACL)
4. Run Quarto compilation
5. Compile HTML
6. Compile RDF/Turtle
7. Validate RDF with SHACL
8. Publish static artifacts
9. DOI release/versioning (if configured)

See ADR-014 for full rationale.

## Release Process

- Tags on main for human workflow: `v0.1.0`
- Immutable provenance uses full commit SHA, not tags.
- See ADR-003 for identity model.
