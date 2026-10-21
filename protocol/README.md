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
| `protocol.manifest.json` | Pinned revision + artifact SHA-256 digests (generated; see versioning.md) |

Examples and fixtures:

| File | Purpose |
|------|---------|
| `examples/article.ttl` | Example publication (valid article) |
| `examples/publication-registry.ttl` | Example publication registry |
| `examples/` | Reference examples validated against the shapes |

### `opendraft.ttl` — Core Vocabulary

Defines the OpenDraft ontology: classes for publications, registries, and subject assignments; properties linking them together.

Aligns with SPAR/OCDM (ADR-021): `od:Publication` is an `rdfs:subClassOf fabio:Expression` (one published version, version DOI), authorship follows the OpenCitations Data Model role pattern, and the 14 NISO CRediT roles are declared `pro:Role` instances.

Reuses established vocabularies where possible (reference-only prefixes — no `owl:imports`):
- **SPAR** — FaBiO (`fabio:`, Work/Expression/SubjectTerm), FRBR (`frbr:`, realizationOf/revisionOf), PRO (`pro:`, Role/RoleInTime/isHeldBy/withRole), SCoRO (`scoro:`, corresponding-author/affiliate/isEqualToRoleInTime)
- **OpenCitations** — OCO (`oco:`, hasNext author order); OCDM identifier patterns via DataCite (`datacite:`) and Literal (`literal:`)
- **PRISM** (`prism:`, versionIdentifier/keyword), **FRAPO** (`frapo:`, Grant), **CiTO** (`cito:`, cites), **NISO CRediT** (`credit:`)
- **Dublin Core Terms** (`dcterms:`) — title, creator, subject, identifier, date, license, abstract
- **FOAF** (`foaf:`) — Person, Group, Organization, name, mbox
- **SKOS** (`skos:`) — Concept, prefLabel, ConceptScheme
- **PROV-O** (`prov:`) — Agent (for subject assignment provenance)

Custom `od:` terms cover only what existing vocabularies do not express: Git-specific provenance, registry structure, subject assignment reification, and the author flags `od:isDeceased`/`od:onBehalfOf`.

Provenance follows the **flat model** (ADR-018): scalars live directly on `od:Publication`.

### `article.shacl.ttl` — Article Validation

SHACL shapes validating that an article RDF graph conforms to the protocol. **SHACL Core only** (no SHACL-SPARQL) and **one publication per graph** (ADR-021): the shapes assume every `pro:RoleInTime` node belongs to the single `od:Publication` in the file. See ADR-018 for the provenance model.

Required properties for a valid publication:
- `dcterms:title` (exactly 1, `xsd:string`)
- `dcterms:creator` (at least 1; always emitted as a shortcut for each author agent)
- Identifier: `dcterms:identifier` or an OCDM `datacite:hasIdentifier` node
- `od:repositoryUrl` (exactly 1, `xsd:anyURI`)
- `od:manuscriptPath` (exactly 1)
- `od:sourceRevision` (exactly 1, 40-char hex SHA `^[0-9a-f]{40}$`)
- `od:protocolRevision` (exactly 1, 40-char hex SHA `^[0-9a-f]{40}$`)
- `frbr:realizationOf` (exactly 1, qualified to a `fabio:Work`); `frbr:revisionOf` at most 1; a publication IRI may not be a `fabio:Work`
- Authorship: at least 1 `pro:withRole pro:author` role; exactly one chain head in the `oco:hasNext` chain; each role exactly 1 `pro:isHeldBy`; person authors carry `foaf:familyName` or `foaf:name` and hold a `scoro:affiliate` role with exactly 1 named organization; `foaf:Group` authors carry `foaf:name`; at least 1 `scoro:corresponding-author` role whose holder has `foaf:mbox`
- Role values (`pro:withRole`) restricted to the PRO/SCoRO authorship roles plus the 14 NISO CRediT IRIs

Warning severity (does not affect conformance): missing `dcterms:license`; `cito:cites` targeting a `fabio:Work` instead of a version DOI.

Informational severity: `fabio:hasSubjectTerm`, `prism:keyword`, `dcterms:references`. Optional fields validated for structure: `dcterms:abstract` (at most 1).

### `registry.shacl.ttl` — Registry Validation

SHACL shapes enforcing mutual exclusivity between registry types:
- **Collection registries** must contain at least one registry and must not contain publications.
- **Publication registries** must contain at least one publication and must not contain other registries.

### `registry.ttl` — Example Collection Registry

A working example of a collection registry referencing a child publication registry by IRI. Publication registries live in `examples/publication-registry.ttl`; articles in `examples/article.ttl`. Demonstrates the expected structure for discovery hierarchies.

## Protocol Versioning

The protocol version is the **full Git commit SHA** of this repository at the time a publication was produced. No mutable refs (tags, branches) are used as protocol identifiers.

See the normative spec for the revision model, commit-derivation rule, and artifact URI conventions: [protocol/versioning.md](versioning.md)

Rationale: [docs/ADR/007-protocol-artifacts.md](../docs/ADR/007-protocol-artifacts.md)

Flat provenance model: [docs/ADR/018-flat-provenance-model.md](../docs/ADR/018-flat-provenance-model.md)

SPAR/OCDM alignment (term mapping, Work/Expression DOIs, one-publication-per-graph, fork/publish identity rule): [docs/ADR/021-spar-ocdm-publication-metadata.md](../docs/ADR/021-spar-ocdm-publication-metadata.md)

## Protocol Commit Pinning

Publications record the protocol commit SHA. Protocol artifacts are retrieved via immutable file-at-commit URLs, e.g.:

```
https://raw.githubusercontent.com/konsulin-care/opendraft/<commit-sha>/protocol/opendraft.ttl
```

This enables independent verification: any party can retrieve the exact protocol version that produced a publication.

## Conformance Testing

Run the conformance suite (wired into pre-push and CI):

```bash
mise run validate-ttl               # TTL syntax (rapper) over all protocol and fixture files
mise run validate-shacl             # SHACL conformance of examples and fixtures
mise run verify-protocol            # Artifacts against the committed manifest
mise run update-protocol-manifest   # Regenerate protocol.manifest.json (clean TTL tree required)
mise run test                       # All suites: RDF, SHACL, Go, TypeScript
```

`test_ttl_parse.sh` validates that all protocol TTL files (core, `examples/`, fixtures) parse correctly with `rapper` and that invalid TTL is rejected. `run-conformance.ts` validates every file in `protocol/examples/` and `tests/conformance/fixtures/valid/` (expecting conform) and every invalid fixture in `tests/conformance/fixtures/invalid/` (expecting non-conform); only `sh:Violation` results count as failures, so warning-only graphs conform.

## Common Pitfalls

1. **Editing TTL without understanding RDF** — learn Turtle syntax first.
2. **Breaking SHACL shapes** — run conformance tests after changes.
3. **Using mutable refs** — always use full commit SHA for protocol version.
4. **Mixing normative and explanatory** — keep TTL in protocol/, docs in manuscripts/.
5. **Forgetting to validate** — run `mise run validate-shacl` before committing.
