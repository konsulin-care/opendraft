# Contributing to OpenDraft

## Development Setup

```bash
# Install all tools (node, pnpm, go, lefthook, golangci-lint, etc.)
mise install

# Install dependencies and set up git hooks
mise run init
```

## Run locally

Copy the example environment file and adjust it as needed:

```bash
cp .env.example .env
```

For the full built application (web app plus the BFF on port 5173):

```bash
mise run serve
```

For hot-reload development, run the BFF and Vite in separate terminals:

```bash
mise run dev-bff   # BFF on :8080, proxied by Vite
mise run dev       # Vite on :5173
```

The three GitHub App variables — `BFF_GITHUB_CLIENT_ID`, `BFF_GITHUB_CLIENT_SECRET` (or `BFF_GITHUB_CLIENT_SECRET_FILE`), and `BFF_GITHUB_APP_SLUG` — are optional. Leave all three empty in `.env` to serve the app read-only without sign-in. Set either all three (login enabled) or none (anonymous read-only); a partial set fails at startup and names the missing variables.

## Available Hooks

### Pre-commit (runs on every commit)

| Check | What it does |
|-------|--------------|
| typescript | Type-checks TypeScript files |
| typescript-web | Type-checks the web app TypeScript |
| eslint | Lints and auto-fixes JS/TS files |
| go-fmt | Formats Go code |
| go-vet | Runs Go static analysis |
| go-mod-tidy | Tidies Go module files |
| validate-ttl | Validates RDF/Turtle files parse correctly |
| yaml-lint | Lints YAML files |
| validate-project | Validates `opendraft.yml` and manuscript structure |
| large-files | Checks files are under 300 lines (`.go`, `.ts`, `.tsx`) |

### Pre-push (runs before push)

| Check | What it does |
|-------|--------------|
| test | Runs all test suites (RDF, SHACL, Go, TypeScript) |
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
mise run typecheck-web   # Run TypeScript type checker for apps/web
mise run serve           # Build the web app and serve it with the local BFF on :5173
mise run dev             # Vite hot-reload dev server on :5173 (proxies /@api to the BFF)
mise run dev-bff         # Run the BFF for Vite dev mode on :8080
mise run build           # Build the web app and the BFF binary
mise run build-bff       # Build the BFF as a static binary
mise run docker-build    # Build the OpenDraft Docker image
mise run build-go        # Build Go code
mise run validate-ttl    # Validate RDF/Turtle files
mise run validate-shacl  # Validate protocol fixtures against SHACL shapes
mise run validate-project # Validate opendraft.yml and manuscript structure
mise run verify-protocol # Verify protocol artifacts against the committed manifest (CI + pre-push)
mise run update-protocol-manifest  # Regenerate protocol manifest and pin project template
mise run build-cli       # Bundle the CLI into packages/cli/dist
mise run smoke-cli       # Smoke-test the packaged CLI tarball
mise run cli             # Run the OpenDraft CLI from source
mise run publish         # Bump, publish the CLI, and roll back on failure
mise run test            # Run all test suites (RDF, SHACL, Go, TypeScript)
mise run audit           # Run npm security audit
mise run govulncheck     # Run govulncheck on Go code
mise run complexity-ts   # Check TypeScript complexity
mise run check-large-files  # Check for files > 300 lines
mise run coverage-ts     # Run TypeScript tests with coverage
mise run coverage-go     # Run Go tests with coverage
```

## CI/CD Pipeline

GitHub Actions runs on PRs to `master` with 8 parallel jobs:

| Job | What it checks |
|-----|----------------|
| lint | ESLint, golangci-lint, TTL validation, YAML lint, large-file check |
| test | All test suites (RDF, SHACL, Go, TypeScript, protocol verification) |
| verify-protocol | Protocol artifacts against the committed manifest (full git history) |
| build | TypeScript build, Go build |
| cli | Smoke-tests the packed CLI tarball |
| security | npm audit, govulncheck |
| complexity | TypeScript complexity, Go complexity |
| coverage | Test coverage for TS and Go |

## Dependency Updates

Renovate automatically creates PRs for dependency updates:

- Minor/patch updates are auto-merged
- Major updates require manual review
- Covers npm, mise tool versions, and Go modules

## Workflow

See [docs/agents/WORKFLOW.md](docs/agents/WORKFLOW.md) for full Git workflow, PR process, and CI/CD details.

## Tooling Decisions

See [docs/ADR/017-tooling-environment.md](docs/ADR/017-tooling-environment.md) for rationale on tool choices and hook placement philosophy.

## Protocol Manifest Policy

Any change to a `.ttl` artifact under `protocol/` must ship with a refreshed `protocol/protocol.manifest.json` and `templates/project/opendraft.yml`. Without that refresh, `mise run verify-protocol` fails — locally, in pre-push, and in the CI `verify-protocol` job (`feat: any protocol/**/*.ttl change without manifest/template refresh fails verify-protocol`).

Regeneration rules:

- Run `mise run update-protocol-manifest` to regenerate. It resolves the revision from the last commit touching protocol artifacts (`git rev-list -1 HEAD -- ':(glob)protocol/**/*.ttl'`), so doc/CI-only changes never bump the revision.
- Regeneration is a **canonical-repository operation**. On a fork, the generator refuses to run unless you pass an explicit `--repository <url>` (see `mise run update-protocol-manifest --help`), which is how upstream-targeted fork PRs declare intent.
- A fork PR that changes protocol artifacts without refreshing the manifest/template fails CI.
- After a squash-merge, a maintainer regenerates once on `master`. Because the manifest commit never touches `.ttl`, the declared protocol SHA stays stable across regeneration.
- Protocol changes to the canonical repository: run `mise run update-protocol-manifest --canonical` on `master` (or `--check --canonical`) to enforce the canonical repository URL.

Spec: [protocol/versioning.md](protocol/versioning.md).

## Protocol Changes

Protocol artifacts in `protocol/` are normative. Changes require careful consideration. See [protocol/README.md](protocol/README.md) for artifact descriptions and [docs/ADR/](docs/ADR/) for architectural decisions.
