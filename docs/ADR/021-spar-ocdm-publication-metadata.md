# ADR 021: SPAR/OCDM Publication Metadata

**Status:** Accepted  
**Date:** 2026-10-21  
**Supersedes (in part):** [ADR-008](008-publication-rdf.md) — custom term representation of subjects, corresponding authorship, and CRediT roles  
**Amends:** [ADR-005](005-authorship-model.md) — authorship facts are per-document roles  

## Context

The pre-release vocabulary grew a set of custom `od:` terms that duplicated
established ontologies. The SPAR suite (FaBiO, FRBR, PRO, SCoRO), the
OpenCitations ontologies (OCO, and the OpenCitations Data Model patterns via
the DataCite and Literal ontologies), PRISM, FRAPO, CiTO, and NISO CRediT
already model publications, expressions, roles, affiliation, author order,
keywords, grants, and citations — and third-party consumers can only find
that semantics if we use the standard IRIs.

The protocol is pre-release, so removed terms are **deleted, not deprecated**
(ADR-018 precedent): no `owl:deprecated` annotations, no tombstones. The
protocol is versioned by Git commit SHA (ADR-007), so any prior snapshot
remains retrievable for publications that pinned it.

## Decision

### Reference-only prefixes

`protocol/opendraft.ttl` declares prefixes for the reused vocabularies
(`fabio:`, `frbr:`, `pro:`, `scoro:`, `oco:`, `prism:`, `frapo:`, `cito:`,
`datacite:`, `literal:`, `credit:`) for **reference only**. The ontology does
not `owl:import` them: validation loads the OpenDraft shapes plus whatever
prefixes a graph uses, and importing eleven vocabularies would drag their
entire axiom sets into every conformance run. Custom `od:` terms are kept
only where no reused vocabulary expresses the concept: Git provenance
scalars, registry structure, subject-assignment reification, and the two
author flags `od:isDeceased` and `od:onBehalfOf`.

### Term mapping

| Pre-ADR-021 construct | SPAR/OCDM replacement |
|------------------------|------------------------|
| `od:PublicationVersion` (class) | Deleted — `od:Publication rdfs:subClassOf fabio:Expression`; one `od:Publication` node per published version |
| `od:hasSubject` | `fabio:hasSubjectTerm` (shortcut); `od:SubjectAssignment` retained for who/when provenance |
| `od:isCorrespondingAuthor` (flag on person) | `scoro:corresponding-author` role held via `pro:withRole` |
| `od:creditRole` (literal on author) | `pro:withRole credit:<slug>` on a `pro:RoleInTime` node |
| `od:assignedSubject` range `skos:Concept` | range `fabio:SubjectTerm` |
| Authors as `dcterms:creator` literals only | OCDM direction: `<pub> pro:isDocumentContextFor` role nodes; `role pro:isHeldBy` agent; `dcterms:creator` shortcut triple still always emitted for searchability |
| Author order as document order / list | `oco:hasNext` chain between roles carrying `pro:withRole pro:author` |
| Affiliation as free-text field | `scoro:affiliate` role with `pro:relatesToOrganization` → organization with `foaf:name` |
| — (new) | `od:isDeceased` (`xsd:boolean`, domain `foaf:Person`) |
| — (new) | `od:onBehalfOf` (domain `pro:RoleInTime`, range `foaf:Agent`) |
| — (new) | The 14 NISO CRediT role IRIs declared `a pro:Role` with `rdfs:label` |

`pro:withRole` values are restricted by SHACL to `pro:author`,
`scoro:corresponding-author`, `scoro:affiliate`,
`scoro:consortium-author`, and the 14 `credit:*` roles.

### One publication per graph

`protocol/article.shacl.ttl` uses SHACL Core only — `rdf-validate-shacl` has
no SHACL-SPARQL implementation — so every cross-role constraint (single
chain head, at most one successor/predecessor, one holder per role) is
expressed with `sh:qualifiedValueShape` rooted at the single
`od:Publication` in the graph, or at `pro:RoleInTime` nodes assuming they
belong to that publication's closure.

Consequently the shapes **assume one publication per graph**: a Turtle file
validated by the conformance suite contains exactly one
`od:Publication`. Publication registries (`od:containsPublication`) and
fixtures follow this rule. Multi-publication graphs would need per-chain
scoping that SHACL Core cannot express without SPARQL.

### Compiler invariant: no `oco:hasNext` cycles

The YAML→RDF compiler emits the author chain from the ordered author list
in `_author.yml`. The invariant: **the emitted `oco:hasNext` graph is a
simple path** — every author role appears exactly once, each role has at
most one successor and one predecessor, and the first author in YAML order
is the unique head with no incoming `oco:hasNext`. A cycle would leave the
chain with no head, which the shapes reject (`Exactly one author role must
head the oco:hasNext author chain`), so cycle-freedom is both a compiler
guarantee and a validation-enforced property.

### Identifiers: normalized IRI plus OCDM node

Agents, organizations, and publications carrying an ORCID, ROR, or DOI use
the **normalized IRI as the subject IRI** (ORCID stripped of the URL prefix
and hyphenated with a valid checksum, ROR canonical
`https://ror.org/<id>`, DOI lowercased with the resolver prefix stripped;
all IRIs `https`, bare host). Using the canonical IRI as node identity
means SPARQL joins and cross-graph deduplication work without any
parsing: two records about ORCID `0000-0002-1825-0097` share a subject.

The same records additionally carry an OCDM `datacite:hasIdentifier` node
(`datacite:usesIdentifierScheme datacite:orcid|ror|doi` plus
`literal:hasLiteralValue`). Rationale: OpenCitations consumers expect
scheme/value structure they can read without IRI surgery, and the literal
value round-trips the deposit form (e.g. hyphenated ORCID) verbatim. The
IRI is for machines joining graphs; the node is for machines reading
deposits. Nodes without a recognized identifier use blank nodes but still
carry the identifier node when one exists.

### Work and Expression: concept DOI vs version DOI

Following the Zenodo pattern and FRBR:

- The manuscript is one `fabio:Work`, identified by its **concept DOI**.
- Each published version is one `od:Publication` (a `fabio:Expression`)
  with exactly one `frbr:realizationOf` pointing at that Work, identified
  by its **version DOI**, and `prism:versionIdentifier` naming the version.
- A version may carry at most one `frbr:revisionOf` pointing at the
  previous version.
- FRBR declares `frbr:Expression owl:disjointWith frbr:Work`, and the
  shapes add `sh:not` a `fabio:Work` on `od:Publication`: **Work and
  Expression never share an IRI or a DOI**. The concept DOI resolves to the
  Work; version DOIs resolve to Expressions.
- Citations (`cito:cites`) target a specific **version DOI**, not the
  concept DOI — citing the Work is a warning — so a claim always points at
  the exact text that was read.

### Fork/publish identity rule

`opendraft.yml` gains a top-level `repository` (the registered original
project repository URL) and per-manuscript `concept-doi` plus
`concept-doi-repository` (the repository URL at which the concept DOI was
minted). Both are written once at first publish and are immutable
afterwards.

Publishing is allowed only when the **normalized current repository URL
equals the registered `repository`** (trailing slash, `.git` suffix, and
http/https differences ignored):

| State | Outcome |
|-------|---------|
| no `concept-doi` | `new-work` — mint a concept DOI and a v1 version DOI |
| `concept-doi` present, URLs match | `new-version` — mint a version DOI only, same Work |
| URLs differ | `repository-mismatch` — blocked, with two remedies below |
| `repository` equals current URL but `concept-doi-repository` differs | integrity error `concept-doi-bound-to-other-repository` |

Remedies for `repository-mismatch`:

1. **Pull request** — open a PR against the registered repository and
   publish from there as a new version of the existing Work.
2. **Publish independently** — change `repository` to the fork URL *and*
   clear every manuscript `concept-doi`, producing a new Work with new
   concept and version DOIs.

Changing `repository` while keeping a `concept-doi` bound to a different
`concept-doi-repository` is reported as an integrity error, not a blocked
publish: the file is internally inconsistent and must be fixed first.

Verifying a concept DOI against the DOI registry is a pipeline concern and
is not part of this ADR's scope.

## Consequences

- Publications speak standard SPAR/OCDM IRIs; tooling built for FaBiO,
  PRO, SCoRO, OCO, PRISM, FRAPO, and CiTO works against OpenDraft graphs
  unchanged.
- The vocabulary shrinks: four custom terms deleted, two added, and the
  CRediT block replaces hand-rolled role literals.
- SHACL Core keeps `rdf-validate-shacl` sufficient for conformance, at the
  cost of the one-publication-per-graph assumption, which is documented and
  enforced by fixture layout.
- Concept/version DOI separation gives forks a well-defined identity rule:
  the registered repository owns the Work, forks either contribute versions
  or mint their own Work.
- `dcterms:creator` and `dcterms:subject` shortcut triples are always
  emitted, so simple consumers never need to traverse the role graph.

## References

- [ADR-005](005-authorship-model.md) — amended: authorship is per-document
- [ADR-008](008-publication-rdf.md) — superseded in part
- [ADR-018](018-flat-provenance-model.md) — delete-not-deprecate precedent
- SPAR: <https://www.sparontologies.net/>
- OpenCitations ontologies: <https://w3id.org/oc/ontology/>
- NISO CRediT: <https://credit.niso.org/>
- Zenodo concept/version DOIs: <https://help.zenodo.org/docs/deposit/manage-records/>
