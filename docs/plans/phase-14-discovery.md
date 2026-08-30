# Phase 14 — Discovery

**Summary:** Enables loading, filtering, and traversing registries hierarchically to discover and selectively retrieve publications without a central server.

---

## OD-140 — Implement registry loading

### Atomic Instruction

Allow OpenDraft to load a remote `registry.ttl`.

### Definition of Done

- [ ] Client can retrieve and parse a registry from a static URL.

---

## OD-141 — Implement registry type detection

### Atomic Instruction

Determine whether loaded registry is a collection or publication registry.

### Definition of Done

- [ ] Client correctly routes the resource according to its RDF type.

---

## OD-142 — Implement subject filtering

### Atomic Instruction

Allow users to filter registries by SKOS subject.

### Definition of Done

- [ ] Client can select a subject and remove irrelevant registry branches before downloading publications.

---

## OD-143 — Implement recursive registry traversal

### Atomic Instruction

Traverse collection registries recursively.

### Definition of Done

- [ ] Client can traverse registry -> registry -> publication registry without requiring a central server.

---

## OD-144 — Implement selective publication retrieval

### Atomic Instruction

Allow users to select individual publications from a publication registry.

### Definition of Done

- [ ] Client downloads only selected `article.ttl` resources.
