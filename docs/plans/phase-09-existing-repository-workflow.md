# Phase 9 — Existing Repository Workflow

**Summary:** Allows users to open existing GitHub repositories, detect OpenDraft projects, and safely initialize OpenDraft structure without destroying existing content.

---

## OD-090 — Implement repository listing

### Atomic Instruction

Display repositories available through the authorized GitHub App installation.

### Definition of Done

- [ ] User can select a repository they are authorized to access.

---

## OD-091 — Implement repository clone/fetch

### Atomic Instruction

Fetch repository contents into IndexedDB.

### Definition of Done

- [ ] Repository can be loaded without server-side manuscript storage.

---

## OD-092 — Implement `opendraft.yml` detection

### Atomic Instruction

Inspect the repository root after cloning.

### Definition of Done

- [ ] Application distinguishes OpenDraft repository from non-OpenDraft repository.

---

## OD-093 — Implement safe initialization prompt

### Atomic Instruction

If `opendraft.yml` is absent, offer initialization.

### Definition of Done

- [ ] Application never silently modifies an unrecognized repository.

---

## OD-094 — Implement repository initialization

### Atomic Instruction

Add OpenDraft structure to an existing repository.

### Definition of Done

- [ ] Initialization preserves existing files and creates only required OpenDraft files.
- [ ] Initialization produces one clear Git commit.
