# ADR 013: Repository Workflows

**Status:** Accepted  
**Date:** 2024-01-01  
**PROPOSAL.md:** §28, §29, §30, §31

## Context

Users interact with repositories in different ways: starting fresh, joining existing projects, or forking.

## Decision

Three distinct workflows:

### New Repository
1. Create local project.
2. Draft locally.
3. Initialize Git.
4. Authorize GitHub.
5. Create repository.
6. Push.

### Existing Repository
1. Select repository.
2. Authorize GitHub.
3. Clone/fetch.
4. Inspect `opendraft.yml`.
5. If exists: load project.
6. If not: ask user, then initialize.

### Fork Workflow
1. Enter repository URL.
2. Authorize GitHub.
3. Select destination owner.
4. Fork repository.
5. Clone/fetch fork.
6. Edit.

### Initialization
- Add `opendraft.yml`, `manuscripts/`, `.github/workflows/`.
- Preserve existing project structure.
- Single Git commit where practical.

## Consequences

- Flexible entry points for different users.
- Non-destructive to existing projects.
- Forking does not confer protocol authority.

## References

- PROPOSAL.md §28, §29, §30, §31
