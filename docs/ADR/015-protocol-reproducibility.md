# ADR 015: Protocol Reproducibility

**Status:** Accepted  
**Date:** 2024-01-01  
**PROPOSAL.md:** §33

## Context

Publications must be verifiable against the exact protocol version that produced them.

## Decision

Every publication records:

```text
source repository
source commit
OpenDraft protocol repository
OpenDraft protocol commit
OpenDraft protocol version
```

### Reproducibility Chain

```text
Publication
    ↓
Manuscript
    ↓
Source commit
    ↓
Protocol commit
    ↓
Protocol artifacts
```

## Consequences

- Any publication can be traced to exact source and protocol.
- Protocol changes don't retroactively affect publications.
- Independent verification possible without OpenDraft.
- Supports audit and re-publication workflows.

## References

- PROPOSAL.md §33
