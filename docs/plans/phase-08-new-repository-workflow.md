# Phase 8 — New Repository Workflow

**Summary:** Enables users to create a new project locally, initialize Git, configure the repository through the UI, and push it to GitHub as a new repository.

---

## OD-080 — Implement local project creation

### Atomic Instruction

Allow a user to create a project locally.

### Definition of Done

- [ ] Application creates `opendraft.yml`.
- [ ] Application creates `manuscripts/` directory.
- [ ] Application creates `.github/workflows/` directory.
- [ ] Application creates a manuscript template.

---

## OD-081 — Implement local Git initialization

### Atomic Instruction

Initialize the new project as Git.

### Definition of Done

- [ ] A valid initial commit can be created locally.

---

## OD-082 — Implement repository creation UI

### Atomic Instruction

Allow user to choose repository name, personal account, organization, and visibility.

### Definition of Done

- [ ] User can select repository name.
- [ ] User can select personal account or organization.
- [ ] User can select visibility.
- [ ] Selection is passed to the BFF only when required.

---

## OD-083 — Implement initial push

### Atomic Instruction

Push the local repository to GitHub.

### Definition of Done

- [ ] A newly created GitHub repository contains the complete local project.
