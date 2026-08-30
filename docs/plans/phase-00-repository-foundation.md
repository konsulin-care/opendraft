# Phase 0 — Repository Foundation

**Summary:** Establishes the monorepo structure and canonical RDF vocabulary that all subsequent phases build on.

---

## OD-001 — Create OpenDraft monorepo

### Atomic Instruction

Create the OpenDraft repository with the initial monorepo structure.

### Definition of Done

- [ ] Repository exists.
- [ ] Directory structure (`apps/`, `packages/`, `protocol/`, `manuscripts/`, `templates/`, `tests/`) exists.
- [ ] Root README exists.
- [ ] Development instructions exist.
- [ ] CI can execute successfully.
- [ ] No application-specific protocol semantics are embedded outside the protocol package without documentation.

---

## OD-002 — Define OpenDraft namespace

### Atomic Instruction

Define the canonical OpenDraft RDF namespace.

### Definition of Done

- [ ] Namespace is documented.
- [ ] Namespace is used consistently.
- [ ] `protocol/opendraft.ttl` uses the namespace.
- [ ] Namespace is not GitHub-specific.
- [ ] Namespace is documented in the protocol manuscript.

---

## OD-003 — Create `protocol/opendraft.ttl`

### Atomic Instruction

Create the initial OpenDraft RDF vocabulary.

### Definition of Done

- [ ] The ontology defines at minimum: project/repository concept, manuscript, publication, publication version, registry, collection registry, publication registry, source repository, source revision, protocol revision, subject, publication DOI.
- [ ] The TTL parses successfully with a standard RDF parser.

---

## OD-004 — Create protocol artifact README

### Atomic Instruction

Document the purpose and role of the protocol artifacts.

### Definition of Done

- [ ] README explains `opendraft.ttl`.
- [ ] README explains `article.shacl.ttl`.
- [ ] README explains `registry.shacl.ttl`.
- [ ] README explains `registry.ttl`.
- [ ] README explains protocol versioning.
- [ ] README explains protocol commit pinning.
- [ ] README explains conformance testing.
