# ADR 022: Explicit Author Type via Quarto Metadata

**Status:** Accepted  
**Date:** 2026-10-22  
**Amends:** [ADR-005](005-authorship-model.md) — authorship model gains an explicit person/group distinction  
**Relates to:** [ADR-021](021-spar-ocdm-publication-metadata.md) — SPAR/OCDM agent and role mapping  

## Context

OpenDraft stores authors in `_author.yml`, which is consumed both by
OpenDraft tooling and by Quarto (via the `metadata-files` directive,
ADR-004). Any field we add must therefore survive Quarto's author
processing.

**Quarto accepts arbitrary metadata on authors.** Quarto's author schema
allows extra keys, and it normalizes unknown author-level keys under a
`metadata` bag rather than dropping or rejecting them. A field placed at
`metadata.author-type` is therefore Quarto-safe: it round-trips through
Quarto's YAML handling untouched, unlike a bespoke top-level key that
Quarto might strip or warn about.

**Quarto adds `literal` to persons.** Until now, OpenDraft inferred an
author's type from the shape of `name`: an object with `literal` and no
`given`/`family` was assumed to be a group (consortium, institution,
working group). That heuristic breaks because Quarto itself writes a
`literal` rendering of the name for person authors — notably for
single-name persons (e.g. `Plato`), but also during its own name
normalization. A literal-only name no longer distinguishes a consortium
from a mononymous human, so the implicit rule misclassifies authors in
the byline, in RDF, in `on-behalf-of` validation, and in publish checks.

The type of an author is a semantic fact, not something derivable from
name punctuation; it must be stated explicitly, with the old heuristic
kept only as a fallback for documents written before this ADR.

## Decision

### `metadata.author-type`

Each author in `_author.yml` may carry an explicit type:

```yaml
authors:
  - name:
      literal: Plato
    metadata:
      author-type: person   # person | group
  - name:
      literal: The OpenDraft Consortium
    metadata:
      author-type: group
```

- The key lives under `metadata` precisely because Quarto normalizes
  unknown author keys there (see Context). `packages/schema` validates it
  as an enum of exactly `person` and `group` (author.schema.json), and
  the generated TypeScript types mirror it.
- Person authors with a single name keep storing the name as
  `{ literal: X }` — that is valid for people — but mark it with
  `metadata.author-type: person` so it is never mistaken for a group.

### Resolution rule: explicit type wins, legacy heuristic falls back

All person/group decisions go through one shared helper,
`isGroupAuthor(author)` (packages/schema/src/author-type.ts):

1. If `metadata.author-type` is present, it decides: `group` → group,
   `person` → person — regardless of the name shape. A person with a
   literal-only name is a person; a group with a structured name is a
   group.
2. If `metadata.author-type` is absent (legacy documents), the previous
   rule applies unchanged: a `name` object with `literal` and no
   `given`/`family` is a group; anything else is a person.

Every previous inline "literal means group" check — schema integrity
(`on-behalf-of` targets), publish profile (`isPerson`), the RDF
authorship graph, the web byline model, and the author form components —
was rewritten to call this helper, so one rule, one place.

### FOAF/SPAR mapping

The author type maps directly onto the SPAR/OCDM agent vocabulary
established by ADR-021:

| Author type | RDF agent | Name | Author role |
|-------------|-----------|------|-------------|
| person | `a foaf:Person` | `foaf:name` (literal-only names) or `foaf:givenName` + `foaf:familyName` | `pro:withRole pro:author`, held via `pro:isHeldBy` |
| group | `a foaf:Group` | `foaf:name` | `pro:withRole scoro:consortium-author` |

- **Persons emit `foaf:Person` even with a literal-only name.** The
  shapes in `protocol/article.shacl.ttl` already accept `foaf:name` on
  the agent held by an author role (`sh:minCount 1` on `foaf:name` or
  `foaf:familyName`), so no SHACL change was required.
- **Groups emit `foaf:Group` + `foaf:name` exactly as before**, plus
  `foaf:member` for member lists.
- Person-only affordances follow the type: `foaf:mbox` (corresponding
  email), `od:isDeceased`, ORCID identifier nodes, and affiliations
  (`scoro:affiliate`) apply to persons; `on-behalf-of`
  (`od:onBehalfOf`, range `foaf:Agent`) must target an author that
  resolves to a group — now via `isGroupAuthor`, so an explicit
  `author-type: group` with a structured name is a valid target while a
  single-name person is not.

### Consequences

- **Single-name persons are persons everywhere.** `Plato` with
  `metadata.author-type: person` renders as a regular byline author
  (not a collaborator/on-behalf-of group), passes person publish checks
  (e.g. the missing-affiliation issue now applies to them), and emits
  `a foaf:Person` in RDF.
- **Legacy documents behave exactly as before.** Without the key, the
  literal-only heuristic still classifies names as groups, so existing
  `_author.yml` files need no migration; adding the key later only
  overrides the guess.
- **No Quarto interoperability cost.** The field rides in Quarto's
  supported `metadata` bag; Quarto neither drops nor warns about it, and
  `_author.yml` remains a plain Quarto metadata file.
- **Schema and types stay in sync.** The enum lives in
  author.schema.json; `packages/metadata` types are regenerated from it,
  so the literal/`author-type` combination is validated at load time.
- **Publish readiness is advisory for corresponding authors.** A missing
  email on the corresponding person downgraded from a blocking
  `publish` issue to a non-blocking `warning`; a malformed email format
  still blocks at `commit`. The same `EMAIL_PATTERN` is exported from
  `@opendraft/schema` so UI validation and publish checks agree.
- **The heuristic is now a fallback, not a definition.** New code must
  call `isGroupAuthor` rather than inspecting `name.literal`; the legacy
  branch inside it is the only remaining place that shape-sniffs names.

## References

- [ADR-004](004-manuscript-structure.md) — `_author.yml` via Quarto `metadata-files`
- [ADR-005](005-authorship-model.md) — authorship & CRediT model (amended)
- [ADR-021](021-spar-ocdm-publication-metadata.md) — SPAR/OCDM publication metadata
- FOAF: <http://www.w3.org/ns/foaf#>
- SCoRO (SPAR): <https://www.sparontologies.net/>
