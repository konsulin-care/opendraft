# Contributing to OpenDraft

## Development Setup

```bash
# Install all tools (node, pnpm, go, lefthook, golangci-lint, etc.)
mise install

# Install dependencies and set up git hooks
mise run init
```

## Available Hooks

### Pre-commit (runs on every commit)

| Check | What it does |
|-------|--------------|
| typescript | Type-checks TypeScript files |
| eslint | Lints and auto-fixes JS/TS files |
| go-fmt | Formats Go code |
| go-vet | Runs Go static analysis |
| go-mod-tidy | Tidies Go module files |
| validate-ttl | Validates RDF/Turtle files parse correctly |
| markdownlint | Lints Markdown files |
| yaml-lint | Lints YAML files |
| large-files | Checks files are under 300 lines (`.go`, `.ts`, `.tsx`) |

### Pre-push (runs before push)

| Check | What it does |
|-------|--------------|
| test | Runs conformance tests |
| test-go | Runs Go test suite |
| build | Validates build succeeds |
| build-go | Validates Go build succeeds |
| govulncheck | Checks for known Go vulnerabilities |
| complexity-ts | Validates TypeScript complexity ≤ 15 |
| complexity-go | Validates Go complexity ≤ 15 |

## Bypassing Hooks

If you need to bypass hooks (e.g., for work-in-progress commits):

```bash
# Skip all hooks
git commit --no-verify -m "wip: progress on feature"

# Skip pre-push only
git push --no-verify
```

**Note:** Bypassed hooks will still run in CI. Do not merge PRs with CI failures.

## Commit Convention

Use [conventional commits](https://www.conventionalcommits.org/):

```text
feat: add new feature
fix: correct bug
refactor: restructure without behavior change
docs: documentation only
chore: maintenance, dependencies
test: add or update tests
```

Subject under 75 characters. Body explains what and why.

## Available Tasks

All tasks are defined in `.mise.toml`. Run `mise tasks` to see all available tasks.

```bash
mise run init            # Install dependencies and set up git hooks
mise run lint            # Run ESLint
mise run lint-fix        # Run ESLint with auto-fix
mise run lint-go         # Run golangci-lint
mise run fmt-go          # Check Go formatting
mise run typecheck       # Run TypeScript type checker
mise run build           # Build (placeholder)
mise run build-go        # Build Go code
mise run validate-ttl    # Validate RDF/Turtle files
mise run test            # Run conformance tests
mise run test-go         # Run Go tests
mise run audit           # Run npm security audit
mise run complexity-ts   # Check TypeScript complexity
mise run check-large-files  # Check for files > 300 lines
mise run coverage-ts     # Run TypeScript tests with coverage
mise run coverage-go     # Run Go tests with coverage
```

## CI/CD Pipeline

GitHub Actions runs on PRs to `master` with 7 parallel jobs:

| Job | What it checks |
|-----|----------------|
| lint | ESLint, golangci-lint, TTL validation, markdown/yaml lint |
| test | Conformance tests, Go tests |
| build | TypeScript build, Go build |
| security | npm audit, govulncheck |
| complexity | TypeScript complexity, Go complexity |
| coverage | Test coverage for TS and Go |
| pr-size | Fails if PR > 5000 lines changed |

## Dependency Updates

Renovate automatically creates PRs for dependency updates:

- Minor/patch updates are auto-merged
- Major updates require manual review
- Covers npm, mise tool versions, and Go modules

## Workflow

See [docs/agents/WORKFLOW.md](docs/agents/WORKFLOW.md) for full Git workflow, PR process, and CI/CD details.

## Tooling Decisions

See [docs/ADR/017-tooling-environment.md](docs/ADR/017-tooling-environment.md) for rationale on tool choices and hook placement philosophy.

## Protocol Changes

Protocol artifacts in `protocol/` are normative. Changes require careful consideration. See [protocol/README.md](protocol/README.md) for artifact descriptions and [docs/ADR/](docs/ADR/) for architectural decisions.
