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
| `registry.ttl` | Example registry (collection registry) |

### `opendraft.ttl` — Core Vocabulary

Defines the OpenDraft ontology: classes for publications, source repositories, revisions, registries, and subject assignments; properties linking them together.

Reuses established vocabularies where possible:
- **Dublin Core Terms** (`dcterms:`) — title, creator, subject, identifier, date, license, conformsTo
- **FOAF** (`foaf:`) — Person, Organization, name
- **SKOS** (`skos:`) — Concept, prefLabel, ConceptScheme
- **PROV-O** (`prov:`) — Agent (for subject assignment provenance)

Custom `od:` terms cover only what existing vocabularies do not express: Git-specific provenance, registry structure, and subject assignment reification.

### `article.shacl.ttl` — Article Validation

SHACL shapes validating that an article RDF graph conforms to the protocol. Phase 00 includes minimal shapes; full validation is in phase 01.

Required properties for a valid publication:
- `dcterms:title` (exactly 1)
- `dcterms:creator` (at least 1)
- `od:sourceRevision` (exactly 1)
- `od:protocolRevision` (exactly 1)

### `registry.shacl.ttl` — Registry Validation

SHACL shapes enforcing mutual exclusivity between registry types:
- **Collection registries** must contain at least one registry and must not contain publications.
- **Publication registries** must contain at least one publication and must not contain other registries.

### `registry.ttl` — Example Registry

A working example of a collection registry referencing a child publication registry. Demonstrates the expected structure for discovery hierarchies.

## Protocol Versioning

The protocol version is the **full Git commit SHA** of this repository at the time a publication was produced. No mutable refs (tags, branches) are used as protocol identifiers.

Rationale: [docs/ADR/007-protocol-artifacts.md](../docs/ADR/007-protocol-artifacts.md)

## Protocol Commit Pinning

Publications record the protocol commit SHA. The protocol artifacts can be retrieved via raw GitHub URL:

```
https://raw.githubusercontent.com/opendraft/opendraft/<commit-sha>/protocol/opendraft.ttl
```

This enables independent verification: any party can retrieve the exact protocol version that produced a publication.

## Conformance Testing

Run the conformance test suite:

```bash
pnpm test
```

This executes `tests/conformance/protocol/test_ttl_parse.sh`, which validates that all protocol TTL files parse correctly with `rapper` (RDF parser) and that invalid TTL is rejected.

## Common Pitfalls

1. **Editing TTL without understanding RDF** — learn Turtle syntax first.
2. **Breaking SHACL shapes** — run conformance tests after changes.
3. **Using mutable refs** — always use full commit SHA for protocol version.
4. **Mixing normative and explanatory** — keep TTL in protocol/, docs in manuscripts/.
5. **Forgetting to validate** — run `pnpm run validate:ttl` before committing.
