# Phase 9 — Existing Repository Workflow

**Summary:** Allows users to open existing GitHub repositories, detect OpenDraft projects, and safely initialize OpenDraft structure without destroying existing content.

OD-092 to OD-094 are delivered by the Phase 7 reader page and PR-based conversion ([phase-07-go-bff.md](phase-07-go-bff.md), OD-077 and OD-078). This phase references that work instead of duplicating it.

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

Delivered by the Phase 7 reader detection in [phase-07-go-bff.md](phase-07-go-bff.md), OD-077 / OD-078.

### Definition of Done

- [x] Application distinguishes OpenDraft repository from non-OpenDraft repository. See `loadRepo` and `parseManuscripts` in `apps/web/src/reader/load-repo.ts`.

---

## OD-093 — Implement safe initialization prompt

### Atomic Instruction

If `opendraft.yml` is absent, offer initialization.

Delivered by the Phase 7 conversion prompt in [phase-07-go-bff.md](phase-07-go-bff.md), OD-078.

### Definition of Done

- [x] Application never silently modifies an unrecognized repository. See `ConvertPanel` in `apps/web/src/reader/ConvertPanel.tsx`; conversion only starts from the explicit prompt in `apps/web/src/reader/ReaderPage.tsx`.

---

## OD-094 — Implement repository initialization

### Atomic Instruction

Add OpenDraft structure to an existing repository.

Delivered by the Phase 7 PR-based conversion in [phase-07-go-bff.md](phase-07-go-bff.md), OD-078. Initialization is always opened as a pull request (or a fork plus compare URL), never committed directly to the default branch.

### Definition of Done

- [x] Initialization preserves existing files and creates only required OpenDraft files. See `convertRepository` and `readWorkingFiles` in `apps/web/src/reader/convert.ts`.
- [x] Initialization produces one clear Git commit. See `CONVERT_BRANCH`, `CONVERT_COMMIT_MESSAGE` and the single commit in `convertRepository` in `apps/web/src/reader/convert.ts`.
