# ADR 017: Tooling Environment and Hook Placement

**Status:** Accepted  
**Date:** 2024-12-01  
**Updated:** 2025-01-15

## Context

OpenDraft is a monorepo with TypeScript (apps/web), Go (apps/bff), and RDF/Quarto (protocol/). The project needs:

1. Reproducible development environments across team members and CI
2. Code quality gates that prevent technical debt without blocking developer flow
3. Single source of truth for quality checks between local hooks and CI
4. Automated dependency management

## Decisions

### Tool Version Management

Use **mise** as the single source of truth for tool versions and quality tasks.

**Pinned tools:**

- node: lts
- pnpm: 11.13.0
- go: 1.27
- lefthook: 2.1.12
- golangci-lint: 2.13.2
- govulncheck: 1.7.0
- markdownlint-cli2: 0.23.2
- yamllint: 1.38.0

**Quality tasks defined in `.mise.toml`:**

| Task | Purpose |
|------|---------|
| `lint` | Run ESLint |
| `lint-go` | Run golangci-lint |
| `fmt-go` | Check Go formatting |
| `typecheck` | TypeScript type checking |
| `test` | Conformance tests |
| `test-go` | Go tests |
| `build` | Build (placeholder) |
| `build-go` | Build Go code |
| `validate-ttl` | Validate RDF/Turtle files |
| `audit` | npm security audit |
| `complexity-ts` | TypeScript complexity check |
| `check-large-files` | Files > 300 lines |
| `coverage-ts` | TypeScript test coverage |
| `coverage-go` | Go test coverage |

**Rationale:**

- Single `mise install` sets up the complete environment
- Exact version pins ensure reproducibility across team and CI
- Quality tasks are defined once, called from hooks and CI
- Eliminates drift between local and CI checks

### Git Hook Management

Use **lefthook** for git hook management.

**Rationale:**

- Written in Go, single binary, no node_modules bloat
- Faster than JavaScript-based alternatives (husky)
- Works naturally with mise-managed tools
- Parallel execution support for faster hooks

### Hook Placement Philosophy

Checks are distributed across three layers based on cost and blocking behavior. All layers call Mise tasks for consistency.

| Layer | Purpose | Checks | Blocking |
|-------|---------|--------|----------|
| **pre-commit** | Fast feedback on common issues | TypeScript type-check, ESLint (with --fix), Go fmt, Go vet, Go mod tidy, TTL validation, Markdown lint, YAML lint, Large file check | Yes |
| **pre-push** | Validate readiness for review | Tests (pnpm + Go), Build validation, govulncheck, Complexity analysis (TS + Go) | Yes |
| **CI** | Comprehensive analysis + broader checks | All pre-commit/pre-push checks + npm audit, coverage, PR size check | Yes (PR merge) |

#### Pre-commit Rationale

Pre-commit hooks run on every commit. They must be:

- **Fast** (< 5 seconds total)
- **Auto-fixable** where possible (ESLint --fix, gofmt)
- **Convention-focused** (line limits, formatting)

These checks prevent noise in PRs without disrupting developer flow.

#### Pre-push Rationale

Pre-push hooks run before code leaves the developer's machine. They can be:

- **Expensive** (full test suites, security scans)
- **Non-auto-fixable** (complexity violations, test failures)
- **Comprehensive** (build validation)

These checks prevent broken or low-quality code from reaching CI, reducing PR review friction.

#### CI Rationale

CI provides the final gate with 7 parallel jobs:

| Job | What it checks |
|-----|----------------|
| lint | ESLint, golangci-lint, TTL validation, markdown/yaml lint, large files |
| test | Conformance tests, Go tests |
| build | TypeScript build, Go build |
| security | npm audit, govulncheck |
| complexity | TypeScript complexity, Go complexity |
| coverage | Test coverage for TS and Go |
| pr-size | Fails if PR > 5000 lines changed |

CI catches bypassed hooks and adds checks too expensive for local execution (coverage, npm audit).

### Dependency Management

Use **Renovate** for automated dependency updates.

**Configuration:**

- Enabled managers: npm, mise, gomod
- Auto-merge minor and patch updates
- Major updates require manual review
- PRs labeled for easy filtering

**Rationale:**

- Covers all dependency types in the monorepo
- mise manager updates tool versions in `.mise.toml`
- Auto-merge for low-risk updates reduces maintenance burden

## Complexity Thresholds

| Metric | Threshold | Enforced In |
|--------|-----------|-------------|
| Cyclomatic complexity | ≤ 15 | ESLint (TS), golangci-lint (Go) |
| Cognitive complexity | ≤ 15 | golangci-lint (Go) |
| Max lines per function | ≤ 50 | ESLint (TS) |
| Max file lines | ≤ 300 | check-large-files |
| Max nesting depth | ≤ 4 | ESLint (TS) |
| Max nested callbacks | ≤ 3 | ESLint (TS) |
| Max params | ≤ 4 | ESLint (TS) |
| PR size | ≤ 5000 lines | GitHub Actions |

## Consequences

### Positive

- Developers get fast feedback on common issues
- PRs are free of spaghetti code and convention violations
- Environment setup is a single command: `mise install`
- Hooks and CI use identical checks (no drift)
- Automated dependency updates reduce maintenance

### Negative

- Developers must run `mise install` and `lefthook install` after cloning
- Pre-push hooks add ~30 seconds to push time
- Complexity thresholds may require refactoring existing code

### Mitigations

- CONTRIBUTING.md documents setup clearly
- Pre-push runs in parallel to minimize wait time
- Existing code can be grandfathered with eslint-disable comments

## References

- [mise documentation](https://mise.jdx.dev/)
- [lefthook documentation](https://github.com/evilmartians/lefthook)
- [Renovate documentation](https://docs.renovatebot.com/)
- ADR-001: Guiding Architectural Principle
