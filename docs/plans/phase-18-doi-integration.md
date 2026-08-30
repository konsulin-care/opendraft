# Phase 18 — DOI Integration

**Summary:** Defines the DOI release boundary, integrates Zenodo for DOI minting, and ensures each publication version has a distinct DOI identity.

---

## OD-180 — Define DOI release boundary

### Atomic Instruction

Define exactly when a Git version becomes a DOI-bearing publication.

### Definition of Done

- [ ] Documentation specifies: candidate release, validation, publication, DOI minting, immutable release state.

---

## OD-181 — Integrate Zenodo

### Atomic Instruction

Implement DOI minting through Zenodo for the MVP.

### Definition of Done

- [ ] A publication release can create a DOI.
- [ ] The DOI is injected into the publication metadata before or during final publication according to the selected release workflow.

---

## OD-182 — Preserve DOI version identity

### Atomic Instruction

Ensure each publication version can be distinguished.

### Definition of Done

- [ ] Different released versions have distinct DOI identities where required by the publication policy.
