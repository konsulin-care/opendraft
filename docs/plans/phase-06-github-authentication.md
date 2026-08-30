# Phase 6 — GitHub Authentication

**Summary:** Sets up the GitHub App with least-privilege permissions, enabling users to authorize OpenDraft for repository access while keeping secrets server-side.

---

## OD-060 — Register GitHub App

### Atomic Instruction

Create the OpenDraft GitHub App.

### Definition of Done

- [ ] App has documented permissions.
- [ ] App has configured callback URL.
- [ ] App has secure private key storage.
- [ ] App has development and production configuration separation.

---

## OD-061 — Minimize installation permissions

### Atomic Instruction

Request only permissions required for normal repository operation.

### Definition of Done

- [ ] Permissions are documented and reviewed.
- [ ] No unnecessary administrative permission is requested for normal operation.

---

## OD-062 — Implement GitHub App installation flow

### Atomic Instruction

Allow users to install OpenDraft on selected repositories.

### Definition of Done

- [ ] User can start authorization.
- [ ] User can select account/repositories.
- [ ] User can return to OpenDraft.
- [ ] User can identify the installation.
- [ ] User can access authorized repository operations.

---

## OD-063 — Implement GitHub App user authorization

### Atomic Instruction

Implement user authorization for operations that require acting as the user.

### Definition of Done

- [ ] User can authorize OpenDraft through GitHub.
- [ ] Authorization code exchange occurs through the BFF.
- [ ] Client secrets/private keys never reach the browser.
