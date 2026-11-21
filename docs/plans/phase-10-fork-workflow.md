# Phase 10 — Fork Workflow

**Summary:** Enables forking an existing repository, loading the fork locally, and preserving protocol provenance through the fork operation.

The fork endpoint and the compare-URL fallback used when a fork cannot open a PR directly are delivered in Phase 7 ([phase-07-go-bff.md](phase-07-go-bff.md), OD-075 and OD-078). This phase references that work instead of duplicating it.

---

## OD-100 — Implement repository URL input

### Atomic Instruction

Allow user to enter a source repository URL.

### Definition of Done

- [ ] Application validates supported repository URL forms.

---

## OD-101 — Implement GitHub fork operation

### Atomic Instruction

Fork the repository to a user-selected destination.

Delivered by the Phase 7 fork endpoint in [phase-07-go-bff.md](phase-07-go-bff.md), OD-075, and used by the conversion fallback in OD-078.

### Definition of Done

- [ ] User can select personal account or permitted organization.
- [x] Fork is created successfully. See `POST /@api/repos/{owner}/{repo}/forks` in `apps/bff/internal/httpapi/repo_actions.go`; the conversion fallback returns the GitHub compare URL built in `apps/web/src/reader/convert.ts`.

---

## OD-102 — Load fork into local workspace

### Atomic Instruction

Clone/fetch the newly created fork.

### Definition of Done

- [ ] Fork appears as an independent local workspace.

---

## OD-103 — Preserve protocol provenance after fork

### Atomic Instruction

Ensure forking does not modify the protocol authority.

### Definition of Done

- [ ] The project retains the original pinned OpenDraft protocol commit.
