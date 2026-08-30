# ADR 009: Registry Model & Discovery

**Status:** Accepted  
**Date:** 2024-01-01  
**PROPOSAL.md:** §17, §18, §19

## Context

Publications need discoverability without a central database.

## Decision

### Registry Model
Two registry types, mutually exclusive:

- **Collection registry** — references other registries.
- **Publication registry** — references publications.

A registry must not mix both types.

### Discovery Mechanism
Hierarchical, subject-filtered:

1. Start with any known registry.
2. Inspect type (collection or publication).
3. If collection: retrieve child registries.
4. If publication: retrieve articles.
5. Filter by semantic subjects at each level.

### No Central Authority
- Central registry is optional.
- Any trusted registry can be a discovery root.
- Scalable to millions of publishers.

## Consequences

- Federated discovery without central DB.
- Subject filtering reduces bandwidth.
- No single point of failure.
- Supports organic growth of registries.

## References

- PROPOSAL.md §17, §18, §19
