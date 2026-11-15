# ADR 026: Runtime Validation and Protocol Distribution

**Status:** Accepted  
**Date:** 2025-01-01

## Context

The editor and the CLI must enforce one set of manuscript standards, and drafts must be validated against the protocol revision pinned in `opendraft.yml`.

## Decision

### validateProject

`validateProject(ws, options)` in `@opendraft/validate` runs three stages:

1. **project** — `opendraft.yml` and project structure.
2. **manuscript** — naming, assembly, metadata (rules from `@opendraft/schema`).
3. **RDF** — the graph from `compileManuscriptGraph` validated with SHACL.

Findings are `{ level, location, path, message }`. CLI and editor are thin consumers.

### Profiles

- **draft** (default): publish-level metadata issues are warnings. A graph is a draft iff its `od:Publication` has no DOI identifier and no `frbr:realizationOf`. Validated against `article.shacl.ttl`.
- **release** (`--release`): publish-level issues are errors. Validated against `article.shacl.ttl` plus `article-release.shacl.ttl`.

### Protocol resolution order

For the pinned revision, resolve in this order:

1. bundled history (sha256-verified),
2. local cache,
3. fetch `https://raw.githubusercontent.com/<owner>/<repo>/<sha>/protocol/<file>` and cache it,
4. otherwise skip the RDF stage with a warning.

Another revision is never substituted. An unknown fetched revision is validated with a warning to upgrade opendraft.

### compatibleSince

The manifest field `compatibleSince` marks the oldest revision the tool can validate. The bundled content-addressed history (`packages/rdf/src/protocol-history.generated.json`) holds revisions >= `compatibleSince`. A pin older than `compatibleSince` skips RDF with a warning suggesting `opendraft protocol upgrade`.

### Pinning

`opendraft init` and `opendraft protocol upgrade` take the pin from the bundled history `latest`. There is no separate embedded commit constant.

### YAML schemas

YAML JSON Schemas are versioned with the tool (they reflect Quarto rendering capabilities) and are not pinned.

## Consequences

- One rule set for editor, CLI and CI.
- Offline validation works for bundled revisions.
- Reproducibility is preserved: no revision substitution.

## References

- [ADR-007](007-protocol-artifacts.md), [ADR-014](014-publication-pipeline.md), [ADR-015](015-protocol-reproducibility.md)
- [protocol/versioning.md](../../protocol/versioning.md)
