# Phase 11 — Git Collaboration

**Summary:** Adds user-facing Git operations for commits, push/pull synchronization, branching, and pull request creation through the UI.

---

## OD-110 — Implement commit interface

### Atomic Instruction

Provide user-facing Git commit functionality.

### Definition of Done

- [ ] User can inspect changes.
- [ ] User can enter commit message.
- [ ] User can commit.
- [ ] User can inspect resulting SHA.

---

## OD-111 — Implement push/sync

### Atomic Instruction

Implement synchronization with the remote repository.

### Definition of Done

- [ ] User can push local commits.
- [ ] Push failures provide actionable errors.

---

## OD-112 — Implement pull/sync

### Atomic Instruction

Implement remote synchronization.

### Definition of Done

- [ ] Application detects divergent history before destructive operations.

---

## OD-113 — Implement branch creation

### Atomic Instruction

Allow branch creation from the UI.

### Definition of Done

- [ ] User can create and switch branches locally.

---

## OD-114 — Implement pull request creation

### Atomic Instruction

Allow users to open a PR.

### Definition of Done

- [ ] User can select source branch, target branch, title, and description.
- [ ] PR URL is returned.
