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
3. Push branch, open PR.
4. PR title matches commit convention.
5. PR description links related issues.
6. CI passes (lint, test, build).
7. Squash merge into main.

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
