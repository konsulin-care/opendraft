# WORKFLOW.md — Git, PRs, CI/CD

## Branch Strategy

- **master** — stable, always deployable, protected.
- **Feature branches** — `feat/*`, `fix/*`, `docs/*`, `chore/*`.
- **No release branches** in MVP — master is the release.

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

1. Create branch from master.
2. Make changes, commit with conventional messages.
3. Pre-commit hooks run automatically.
4. Push branch (pre-push hooks run).
5. Open PR to master.
6. PR title matches commit convention.
7. PR description links related issues.
8. CI passes (7 parallel jobs).
9. Squash merge into master.

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
- Complexity analysis (TS and Go, cyclomatic ≤ 15)

### Bypassing Hooks

Use `--no-verify` to skip hooks. Bypassed hooks still run in CI.

## CI/CD Pipeline

GitHub Actions workflow in `.github/workflows/ci.yml` runs 7 parallel jobs on PRs to `master`:

| Job | Checks |
|-----|--------|
| lint | ESLint, golangci-lint, TTL validation, markdown/yaml lint, large files |
| test | Conformance tests, Go tests |
| build | TypeScript build, Go build |
| security | npm audit, govulncheck |
| complexity | TypeScript complexity, Go complexity |
| coverage | Test coverage for TS and Go |
| pr-size | Fails if PR > 5000 lines changed |

All jobs use Mise tasks as the single source of truth, ensuring identical checks between local hooks and CI.

### Design Principles

- **Mise as single source of truth**: Every check is defined as a Mise task in `.mise.toml`. Hooks and CI both call `mise run <task>`.
- **Parallel execution**: Jobs run independently for fast feedback. No dependencies between them.
- **Fail fast**: Each job fails independently. A lint failure doesn't block test results.

## Dependency Updates

Renovate automatically manages dependency updates:

- Creates PRs for outdated npm, mise, and Go dependencies
- Auto-merges minor and patch updates
- Major updates require manual review

## Release Process

- Tags on master for human workflow: `v0.1.0`
- Immutable provenance uses full commit SHA, not tags.
- See ADR-003 for identity model.
