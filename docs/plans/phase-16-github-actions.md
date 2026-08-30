# Phase 16 — GitHub Actions

**Summary:** Creates CI/CD workflows for validation and publication, pinning the protocol to an immutable commit and verifying artifacts at build time.

---

## OD-160 — Create validation workflow

### Atomic Instruction

Create the repository GitHub Action responsible for OpenDraft validation.

### Definition of Done

- [ ] Workflow checks out source.
- [ ] Workflow validates project structure.
- [ ] Workflow validates metadata.
- [ ] Workflow validates references.
- [ ] Workflow compiles RDF.
- [ ] Workflow validates RDF with SHACL.

---

## OD-161 — Pin OpenDraft protocol checkout

### Atomic Instruction

Make the workflow retrieve the OpenDraft protocol at an immutable commit.

### Definition of Done

- [ ] Workflow never retrieves the protocol solely from `main`.
- [ ] The exact protocol SHA is visible in build logs/artifacts.

---

## OD-162 — Create publication workflow

### Atomic Instruction

Create the publication build workflow.

### Definition of Done

- [ ] Successful build produces `article.html` and `article.ttl`.
- [ ] Successful build publishes them to the configured static hosting destination.

---

## OD-163 — Verify protocol artifacts during CI

### Atomic Instruction

Verify the protocol artifacts used by the build.

### Definition of Done

- [ ] Build fails when protocol commit is unavailable.
- [ ] Build fails when protocol artifact is altered.
- [ ] Build fails when artifact hash does not match.
- [ ] Build fails when protocol validation fails.
