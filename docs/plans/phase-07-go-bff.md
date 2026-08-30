# Phase 7 — Go BFF

**Summary:** Builds the Go backend-for-frontend that handles confidential GitHub operations, OAuth callbacks, repository creation, and secure session management with minimal resource footprint.

---

## OD-070 — Create Go BFF

### Atomic Instruction

Create the Go BFF service at `apps/bff/`.

### Definition of Done

- [ ] Service builds as a static/minimal binary.
- [ ] Service exposes `/health`.
- [ ] Service starts successfully.
- [ ] Service has no database dependency.
- [ ] Service has no manuscript storage.

---

## OD-071 — Implement GitHub callback

### Atomic Instruction

Implement OAuth callback handling.

### Definition of Done

- [ ] Callback validates state.
- [ ] Authorization code is exchanged server-side.
- [ ] Secrets remain server-side.
- [ ] Invalid state is rejected.

---

## OD-072 — Implement repository creation endpoint

### Atomic Instruction

Implement a narrowly scoped endpoint for repository creation.

### Definition of Done

- [ ] Endpoint requires authenticated user authorization.
- [ ] Repository name is validated.
- [ ] Visibility is explicit.
- [ ] Organization destination is explicit.
- [ ] Arbitrary GitHub API proxying is impossible.
- [ ] Errors are returned safely.

---

## OD-073 — Implement token/session handling

### Atomic Instruction

Implement short-lived secure authentication state.

### Definition of Done

- [ ] Tokens are not logged.
- [ ] Credentials are not exposed in URLs.
- [ ] Cookies/session data use secure attributes where applicable.
- [ ] Expired credentials are rejected.
- [ ] Refresh behavior is explicitly defined.

---

## OD-074 — Benchmark BFF

### Atomic Instruction

Measure BFF resource consumption.

### Definition of Done

- [ ] Under representative idle and light-load conditions: CPU target < 0.25 vCPU, RAM target < 30 MB.
- [ ] Any deviation is documented with measurements.
