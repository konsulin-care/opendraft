# ADR 027: RDF Sections and Vocabulary Reuse

**Status:** Accepted  
**Amends:** [ADR-018](018-flat-provenance-model.md), [ADR-021](021-spar-ocdm-publication-metadata.md)

## Context

Drafts need an RDF identity before any DOI exists, sections need RDF
representation, and several custom `od:` terms duplicate existing
vocabularies. The `urn:opendraft:ontology#` namespace is also not resolvable.

## Decision

### Namespace

The ontology namespace is `https://w3id.org/opendraft/ontology#` (prefix `od:`).
Remaining `od:` terms: `od:Publication`, `od:repositoryUrl`,
`od:sourceRevision`, `od:manuscriptPath`, `od:isDeceased`.
Example and fixture instance IRIs use `https://example.org/`, never `od:`.

### Draft IRI

A graph is a draft iff its `od:Publication` has no DOI identifier
(`dcterms:identifier` / `datacite:hasIdentifier`) and no `frbr:realizationOf`.
The draft root IRI is `https://w3id.org/opendraft/draft/<manuscriptId>`.

### Sections

Each block file becomes a section node, using DoCO and DEO:

```
<PUB#sec-<short>> a doco:Section [, deo:<PascalRole>] ;
    dcterms:title "..." ;
    dcterms:source <raw GitHub URL of blocks/_<short>.qmd at od:sourceRevision> ;
    oco:hasNext <next section> .
<PUB> dcterms:hasPart <PUB#sec-<short>> .
```

doco = `http://purl.org/spar/doco/`, deo = `http://purl.org/spar/deo/`.

### Publication-scoped agent IRIs

Agents without ORCID get IRIs under the publication: `<PUB#author-<id>>`,
`<PUB#group-<id>>`, `<PUB#org-<id>>` (fallback: list index).

### Vocabulary replacements

| Removed term | Replacement |
|--------------|-------------|
| Registries (`od:` registry classes) | `fabio:ExpressionCollection` + `frbr:part` |
| `od:SubjectAssignment` | `oa:Annotation` with `oa:motivatedBy oa:classifying`, `oa:hasTarget`, `oa:hasBody`, `dcterms:creator`, `dcterms:created` (oa = `http://www.w3.org/ns/oa#`) |
| `od:onBehalfOf` | extra `pro:RoleInTime`: `pro:withRole scoro:agent`, `pro:isHeldBy <author>`, `pro:relatesToEntity <group>` |
| `od:protocolRevision` | `dcterms:conformsTo <https://github.com/konsulin-care/opendraft/tree/<sha>/protocol>` |

Removed terms are deleted, not deprecated (ADR-018 precedent).

### Validation

Drafts validate against `protocol/article.shacl.ttl`; releases additionally
against `protocol/article-release.shacl.ttl`.

## Consequences

- Third-party tooling understands sections, annotations and roles.
- The `od:` vocabulary shrinks to five terms.
