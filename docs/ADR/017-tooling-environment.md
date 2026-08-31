# ADR 017: Tooling Environment and Hook Placement

**Status:** Accepted  
**Date:** 2024-12-01

## Context

OpenDraft is a monorepo with TypeScript (apps/web), Go (apps/bff), and RDF/Quarto (protocol/). The project needs:

1. Reproducible development environments across team members and CI
2. Code quality gates that prevent technical debt without blocking developer flow
3. Clear separation of concerns between local checks and CI analysis

## Decisions

### Tool Version Management

Use **mise** as the single source of truth for tool versions.

**Pinned tools:**

- node: lts
- pnpm: 11.13.0
- lefthook: 2.1.12
- golangci-lint: latest
- govulncheck: latest
- markdownlint-cli2: 0.23.2
- yamllint: 1.38.0

**Rationale:**

- Single `mise install` sets up the complete environment
- Exact version pins ensure reproducibility across team and CI
- Eliminates the need for separate tool setup steps in CI workflows
- Aligns with ADR-001: dependencies should be explicit and self-contained

### Git Hook Management

Use **lefthook** for git hook management.

**Rationale:**

- Written in Go, single binary, no node_modules bloat
- Faster than JavaScript-based alternatives (husky)
- Works naturally with mise-managed tools
- Parallel execution support for faster hooks

### Hook Placement Philosophy

Checks are distributed across three layers based on cost and blocking behavior:

| Layer | Purpose | Checks | Blocking |
|-------|---------|--------|----------|
| **pre-commit** | Fast feedback on common issues | TypeScript type-check, ESLint (with --fix), Go fmt, Go vet, Go mod tidy, TTL validation, Markdown lint, YAML lint, Large file check | Yes |
| **pre-push** | Validate readiness for review | Tests (pnpm + Go), Build validation, govulncheck, Complexity analysis (TS + Go) | Yes |
| **CI** | Comprehensive analysis | All pre-commit/pre-push checks + external tools (DeepSource, SonarCloud, Codacy) | Yes (PR merge) |

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

CI provides the final gate. It runs:

- All local checks (catches bypassed hooks)
- External analysis tools (DeepSource, SonarCloud, Codacy)
- Cross-platform validation
- Historical tracking and reporting

## Complexity Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| Cyclomatic complexity | ≤ 15 | Error |
| Max lines per function | ≤ 50 | Error |
| Max file lines | ≤ 300 | Error |
| Max nesting depth | ≤ 4 | Error |
| Max nested callbacks | ≤ 3 | Error |

## Consequences

### Positive

- Developers get fast feedback on common issues
- PRs are free of spaghetti code and convention violations
- Environment setup is a single command: `mise install`
- CI handles deep analysis without duplicating local tooling

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
- ADR-001: Guiding Architectural Principle
