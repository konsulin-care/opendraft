# Contributing to OpenDraft

## Development Setup

```bash
# Install all tools (node, pnpm, lefthook, golangci-lint, etc.)
mise install

# Install dependencies
pnpm install

# Set up git hooks
lefthook install
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
| test | Runs pnpm test suite |
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

## Available Scripts

```bash
pnpm run lint          # Run ESLint
pnpm run lint:fix      # Run ESLint with auto-fix
pnpm run typecheck     # Run TypeScript type checker
pnpm run build         # Build (placeholder)
pnpm run validate:ttl  # Validate RDF/Turtle files
pnpm test              # Run conformance tests
```

## Workflow

See [docs/agents/WORKFLOW.md](docs/agents/WORKFLOW.md) for full Git workflow, PR process, and CI/CD details.

## Tooling Decisions

See [docs/ADR/017-tooling-environment.md](docs/ADR/017-tooling-environment.md) for rationale on tool choices and hook placement philosophy.

## Protocol Changes

Protocol artifacts in `protocol/` are normative. Changes require careful consideration. See [protocol/README.md](protocol/README.md) for artifact descriptions and [docs/ADR/](docs/ADR/) for architectural decisions.
