# ADR 016: MVP Scope

**Status:** Accepted  
**Date:** 2024-01-01  
**PROPOSAL.md:** §34, §35, §36

## Context

OpenDraft has broad ambitions. MVP must be focused and achievable.

## Decision

### MVP Includes

- PWA client
- Local manuscript authoring
- Quarto Markdown
- YAML metadata interfaces
- BibTeX interface
- IndexedDB persistence
- Browser-side Git
- GitHub App integration
- Go BFF
- Repository creation, selection, forking
- OpenDraft initialization
- Pull/push, basic PR support
- RDF vocabulary, SHACL shapes
- Article and registry TTL
- Collection and publication registries
- Human-authored SKOS subjects
- Static HTML and TTL output
- Protocol commit pinning
- Conformance tests
- Self-documenting protocol manuscript

### Deferred

- JATS
- Advanced PDF production
- Automated semantic annotation
- Centralized search/database
- Server-side Git/storage
- Machine-generated CRediT
- Complex peer-review workflows
- Advanced citation graphs
- Cryptographic signing

### Success Criteria

User can: create manuscript, edit locally, push to GitHub, fork, create PR, publish via CI, obtain HTML + TTL, validate with SHACL, discover via registries.

## Consequences

- Focused scope for first release.
- Clear boundaries for contributors.
- Extensible architecture for future phases.

## References

- PROPOSAL.md §34, §35, §36
