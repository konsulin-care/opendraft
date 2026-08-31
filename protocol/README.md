# protocol/ — OpenDraft Protocol Artifacts

This directory contains the normative RDF artifacts defining the OpenDraft protocol. These files are the source of truth for protocol compliance.

## Namespace

The canonical OpenDraft namespace is:

```
urn:opendraft:ontology#
```

Prefix `od:` is used throughout all TTL files. This namespace is a URN (RFC 3986) because no persistent HTTP domain is currently available. When `opendraft.org` is live, HTTP aliases will be minted that dereference to the same terms.

## Artifacts

| File | Purpose |
|------|---------|
| `opendraft.ttl` | Core RDF vocabulary (classes, properties) |
| `article.shacl.ttl` | SHACL shapes for article validation |
| `registry.shacl.ttl` | SHACL shapes for registry validation |
| `registry.ttl` | Example collection registry |

Examples and fixtures:

| File | Purpose |
|------|---------|
| `examples/article.ttl` | Example publication (valid article) |
| `examples/publication-registry.ttl` | Example publication registry |
| `examples/` | Reference examples validated against the shapes |

### `opendraft.ttl` — Core Vocabulary

Defines the OpenDraft ontology: classes for publications, registries, and subject assignments; properties linking them together.

Reuses established vocabularies where possible:
- **Dublin Core Terms** (`dcterms:`) — title, creator, subject, identifier, date, license, conformsTo
- **FOAF** (`foaf:`) — Person, Organization, name
- **SKOS** (`skos:`) — Concept, prefLabel, ConceptScheme
- **PROV-O** (`prov:`) — Agent (for subject assignment provenance)

Custom `od:` terms cover only what existing vocabularies do not express: Git-specific provenance, registry structure, and subject assignment reification.

Provenance follows the **flat model** (ADR-018): scalars live directly on `od:Publication`.

### `article.shacl.ttl` — Article Validation

SHACL shapes validating that an article RDF graph conforms to the protocol. See ADR-018 for the provenance model.

Required properties for a valid publication:
- `dcterms:title` (exactly 1, `xsd:string`)
- `dcterms:creator` (at least 1)
- `dcterms:identifier` (at least 1, DOI)
- `od:repositoryUrl` (exactly 1, `xsd:anyURI`)
- `od:manuscriptPath` (exactly 1)
- `od:sourceRevision` (exactly 1, 40-char hex SHA `^[0-9a-f]{40}$`)
- `od:protocolRevision` (exactly 1, 40-char hex SHA `^[0-9a-f]{40}$`)

Optional fields validated for structure: `dcterms:abstract` (at most 1). Subject (`od:hasSubject`) and references (`dcterms:references`) have informational, non-enforcing shapes.

### `registry.shacl.ttl` — Registry Validation

SHACL shapes enforcing mutual exclusivity between registry types:
- **Collection registries** must contain at least one registry and must not contain publications.
- **Publication registries** must contain at least one publication and must not contain other registries.

### `registry.ttl` — Example Collection Registry

A working example of a collection registry referencing a child publication registry by IRI. Publication registries live in `examples/publication-registry.ttl`; articles in `examples/article.ttl`. Demonstrates the expected structure for discovery hierarchies.

## Protocol Versioning

The protocol version is the **full Git commit SHA** of this repository at the time a publication was produced. No mutable refs (tags, branches) are used as protocol identifiers.

Rationale: [docs/ADR/007-protocol-artifacts.md](../docs/ADR/007-protocol-artifacts.md)

Flat provenance model: [docs/ADR/018-flat-provenance-model.md](../docs/ADR/018-flat-provenance-model.md)

## Protocol Commit Pinning

Publications record the protocol commit SHA. The protocol artifacts can be retrieved via raw GitHub URL:

```
https://raw.githubusercontent.com/opendraft/opendraft/<commit-sha>/protocol/opendraft.ttl
```

This enables independent verification: any party can retrieve the exact protocol version that produced a publication.

## Conformance Testing

Run the conformance suite (wired into pre-push and CI):

```bash
mise run validate-ttl      # TTL syntax (rapper) over all protocol and fixture files
mise run validate-shacl    # SHACL conformance of examples and invalid fixtures
mise run test              # All suites: RDF, SHACL, Go, TypeScript
```

`test_ttl_parse.sh` validates that all protocol TTL files (core, `examples/`, invalid fixtures) parse correctly with `rapper` and that invalid TTL is rejected. `run-conformance.ts` validates every example against the SHACL shapes (expecting conform) and every invalid fixture (expecting non-conform).

## Common Pitfalls

1. **Editing TTL without understanding RDF** — learn Turtle syntax first.
2. **Breaking SHACL shapes** — run conformance tests after changes.
3. **Using mutable refs** — always use full commit SHA for protocol version.
4. **Mixing normative and explanatory** — keep TTL in protocol/, docs in manuscripts/.
5. **Forgetting to validate** — run `mise run validate-shacl` before committing.
