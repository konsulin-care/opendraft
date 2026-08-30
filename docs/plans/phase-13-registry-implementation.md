# Phase 13 — Registry Implementation

**Summary:** Implements collection and publication registry RDF models with SHACL validation, subject metadata, and the ability to register articles and child registries.

---

## OD-130 — Implement registry RDF model

### Atomic Instruction

Implement collection and publication registry semantics.

### Definition of Done

- [ ] Registry RDF can unambiguously indicate collection registry or publication registry.

---

## OD-131 — Implement registry validation

### Atomic Instruction

Validate registries with SHACL.

### Definition of Done

- [ ] Mixed registry contents are rejected.

---

## OD-132 — Implement registry subject metadata

### Atomic Instruction

Allow human-authored SKOS subjects on registries.

### Definition of Done

- [ ] A registry can declare semantic themes used for discovery.

---

## OD-133 — Implement publication registration

### Atomic Instruction

Allow a publication registry to contain article references.

### Definition of Done

- [ ] A valid publication registry can reference `article.ttl`.

---

## OD-134 — Implement collection registration

### Atomic Instruction

Allow a collection registry to contain registry references.

### Definition of Done

- [ ] A valid collection registry can reference child registries.
