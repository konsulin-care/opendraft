# protocol/ — Agent Guide

## Purpose

Contains normative RDF artifacts defining the OpenDraft protocol. These files are the source of truth for protocol compliance.

## Artifact Inventory

| File | Purpose |
|------|---------|
| opendraft.ttl | Core RDF vocabulary (classes, properties) |
| article.shacl.ttl | SHACL shapes for article validation |
| registry.shacl.ttl | SHACL shapes for registry validation |
| registry.ttl | Example collection registry |
| examples/article.ttl | Example publication (validated by article.shacl.ttl) |
| examples/publication-registry.ttl | Example publication registry (validated by registry.shacl.ttl) |

## Normative vs Explanatory

- **This directory is normative** — TTL files define the standard.
- **manuscripts/ is explanatory** — human-readable documentation lives there.
- Changes to protocol/ require careful consideration and ADR.

## Versioning

- Protocol version = Git commit SHA of this repository.
- No mutable refs (tags, branches) as protocol identifiers.
- See ADR-007 for full rationale.

## Common Pitfalls

1. **Editing TTL without understanding RDF** — learn Turtle syntax first.
2. **Breaking SHACL shapes** — run conformance tests after changes.
3. **Using mutable refs** — always use full commit SHA.
4. **Mixing normative and explanatory** — keep TTL in protocol/, docs in manuscripts/.
5. **Forgetting to validate** — run SHACL validation before committing.

## When to Read convention.md

Read [convention.md](convention.md) when:
- Editing any .ttl file
- Modifying SHACL shapes
- Adding new RDF classes or properties

## References

- [docs/agents/PROTOCOL.md](../docs/agents/PROTOCOL.md) — Protocol summary
- [docs/ADR/007-protocol-artifacts.md](../docs/ADR/007-protocol-artifacts.md) — Why RDF
