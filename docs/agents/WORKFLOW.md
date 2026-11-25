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

GitHub Actions workflow in `.github/workflows/ci.yml` runs 8 parallel jobs on PRs to `master`:

| Job | Checks |
|-----|--------|
| lint | ESLint, golangci-lint, TTL validation, markdown/yaml lint, large files |
| test | Conformance tests, protocol verification, Go tests |
| verify-protocol | Protocol artifacts against the committed manifest (uses full git history) |
| build | TypeScript build, Go build |
| security | npm audit, govulncheck |
| complexity | TypeScript complexity, Go complexity |
| coverage | Test coverage for TS and Go |

All jobs use Mise tasks as the single source of truth, ensuring identical checks between local hooks and CI.

Image publishing lives in a separate workflow, `.github/workflows/docker-release.yml`. It runs on GitHub Releases, not on PRs, so it is not part of the table above. See [Release and Image Publishing](#release-and-image-publishing).

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

## Release and Image Publishing

A release is a GitHub Release created by hand in the GitHub UI, with the tag
`vX.Y.Z` pointing at a commit on `master`. Creating the release does not run tests:
the tagged commit is trusted because `master` CI already passed on it.

Publishing a release triggers `.github/workflows/docker-release.yml`, which builds
the root `Dockerfile` and pushes the image to GitHub Container Registry:

| Aspect | Value |
|--------|-------|
| Image | `ghcr.io/<owner>/<repo>`, for example `ghcr.io/konsulin/opendraft` |
| Tags | `vX.Y.Z` (the release tag as-is) and `latest` |
| `latest` | Not applied when the release is marked as a prerelease |
| Platform | `linux/amd64` only |
| `VERSION` build-arg | The release tag name, injected into `main.Version` |
| Attestations | SBOM and max-level SLSA provenance |

Behavior worth knowing:

- **Tag filter**: the release tag must match `^v[0-9]+\.[0-9]+\.[0-9]+$`. A release
tagged `v1.2.3-rc.1` or `v1.2` is skipped with a notice instead of failing the
workflow. Create semver releases only when you want an image.
- **Package visibility**: the first push creates a private ghcr package. Make it
public in the package settings (Package settings → Change visibility) if the
image is meant to be pullable without credentials.
- **Trigger gap**: a release created by another workflow using the default
`GITHUB_TOKEN` does not trigger this workflow. Create releases manually, or use a
PAT, if that ever comes up.
- **Vulnerability scanning**: image scanning with Trivy is deferred; there is no
CVE gate on the release path. Dependency risk is handled by the `security` job in
`ci.yml` and by Renovate.
- **Local build**: for a local image without publishing, use `mise run docker-build`.
