# Contributing to OpenDraft

## Development Setup

```bash
mise install
pnpm install
```

## Commit Convention

Use [conventional commits](https://www.conventionalcommits.org/):

```
feat: add new feature
fix: correct bug
refactor: restructure without behavior change
docs: documentation only
chore: maintenance, dependencies
test: add or update tests
```

Subject under 75 characters. Body explains what and why.

## Workflow

See [docs/agents/WORKFLOW.md](docs/agents/WORKFLOW.md) for full Git workflow, PR process, and CI/CD details.

## Validation

Before committing protocol changes:

```bash
# Validate all TTL files parse correctly
pnpm run validate:ttl

# Run conformance tests
pnpm test
```

## Protocol Changes

Protocol artifacts in `protocol/` are normative. Changes require careful consideration. See [protocol/README.md](protocol/README.md) for artifact descriptions and [docs/ADR/](docs/ADR/) for architectural decisions.
