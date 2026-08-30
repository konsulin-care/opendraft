# Phase 19 — Security

**Summary:** Audits GitHub permissions, BFF secret handling, repository initialization safety, and ensures the BFF does not expose arbitrary API access.

---

## OD-190 — Audit GitHub permissions

### Atomic Instruction

Review all GitHub App permissions.

### Definition of Done

- [ ] Every permission has documented justification.
- [ ] Unneeded permissions are removed.

---

## OD-191 — Audit BFF secrets

### Atomic Instruction

Audit secret handling.

### Definition of Done

- [ ] No private key, client secret, refresh token, or equivalent credential appears in browser source, Git repository, logs, URLs, or error responses.

---

## OD-192 — Audit repository initialization

### Atomic Instruction

Ensure initialization cannot unintentionally destroy repository content.

### Definition of Done

- [ ] Existing files are preserved.
- [ ] Changes are reviewable.
- [ ] Initialization is explicit.

---

## OD-193 — Audit arbitrary API access

### Atomic Instruction

Verify the BFF does not expose a generic GitHub proxy.

### Definition of Done

- [ ] Only explicitly implemented operations are available.
