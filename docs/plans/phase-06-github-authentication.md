# Phase 6 — GitHub Authentication

**Summary:** Sets up the GitHub App with least-privilege permissions, enabling users to authorize OpenDraft for repository access while keeping secrets server-side.

---

## OD-060 — Register GitHub App

### Atomic Instruction

Create the OpenDraft GitHub App.

### Definition of Done

- [x] App has documented permissions (see `docs/github-app.md`).
- [x] App has configured callback URL (production and development).
- [x] No private key is generated or stored at runtime; user access tokens are
      used instead. The future private-key procedure is documented for when a
      feature needs installation tokens.
- [x] App has development and production configuration separation (two apps).

---

## OD-061 — Minimize installation permissions

### Atomic Instruction

Request only permissions required for normal repository operation.

### Definition of Done

- [x] Permissions are documented and reviewed (`docs/github-app.md`).
- [x] No unnecessary administrative permission is requested for normal operation
      (no account permissions; repository creation replaces Administration
      read/write where available).

---

## OD-062 — Implement GitHub App installation flow

### Atomic Instruction

Allow users to install OpenDraft on selected repositories.

### Definition of Done

- [x] User can start authorization (`/@api/auth/install`).
- [x] User can select account/repositories (GitHub installation page).
- [x] User can return to OpenDraft (sealed `returnTo` path).
- [ ] User can identify the installation.
- [ ] User can access authorized repository operations.

---

## OD-063 — Implement GitHub App user authorization

### Atomic Instruction

Implement user authorization for operations that require acting as the user.

### Definition of Done

- [x] User can authorize OpenDraft through GitHub (`/@api/auth/login`).
- [x] Authorization code exchange occurs through the BFF (state + PKCE + client
      secret).
- [x] Client secrets/private keys never reach the browser.
