# Phase 5 — Client Application

**Summary:** Bootstraps the PWA with offline-first local workspace persistence, in-browser Git operations, and dedicated UIs for editing manuscripts, author metadata, abstracts, frontmatter, and references.

---

## OD-050 — Bootstrap PWA

### Atomic Instruction

Create the OpenDraft web application.

### Definition of Done

- [ ] Application loads as a static site.
- [ ] Application works without the BFF for local editing.
- [ ] Application has an application shell.
- [ ] Application can run offline after initial load.

---

## OD-051 — Implement IndexedDB workspace

### Atomic Instruction

Create local project persistence using IndexedDB.

### Definition of Done

- [ ] The application can create a workspace.
- [ ] The application can save files.
- [ ] The application can reload after browser restart.
- [ ] The application can delete a workspace.
- [ ] The application can list workspace files.
- [ ] No manuscript persistence depends on a server.

---

## OD-052 — Implement browser Git repository

### Atomic Instruction

Integrate a browser-compatible Git implementation.

### Definition of Done

- [ ] The client can initialize Git.
- [ ] The client can create a commit.
- [ ] The client can inspect status.
- [ ] The client can inspect diff.
- [ ] The client can create a branch.
- [ ] The client can checkout a branch.

---

## OD-053 — Implement local manuscript editor

### Atomic Instruction

Implement Quarto Markdown editing.

### Definition of Done

- [ ] User can edit `article.qmd`.
- [ ] User can save changes.
- [ ] User can reopen changes.
- [ ] User can preview Markdown.
- [ ] YAML metadata files are preserved.

---

## OD-054 — Implement author metadata UI

### Atomic Instruction

Create dedicated UI for `_author.yml`.

### Definition of Done

- [ ] User can add author.
- [ ] User can remove author.
- [ ] User can reorder authors.
- [ ] User can edit author metadata.
- [ ] User can add ORCID.
- [ ] User can designate corresponding author.
- [ ] User can save valid YAML.

---

## OD-055 — Implement abstract metadata UI

### Atomic Instruction

Create dedicated UI for `_abstract.yml`.

### Definition of Done

- [ ] User can edit abstract-related metadata without manually editing YAML.

---

## OD-056 — Implement frontmatter metadata UI

### Atomic Instruction

Create dedicated UI for `_frontmatter.yml`.

### Definition of Done

- [ ] User can edit title.
- [ ] User can edit keywords.
- [ ] User can edit subjects.
- [ ] User can edit funding.
- [ ] User can edit acknowledgments.
- [ ] User can edit license.
- [ ] User can edit relevant dates.
- [ ] User can edit related resources.

---

## OD-057 — Implement reference UI

### Atomic Instruction

Create a reference-management interface for `references.bib`.

### Definition of Done

- [ ] User can add reference.
- [ ] User can edit reference.
- [ ] User can delete reference.
- [ ] User can inspect DOI.
- [ ] User can search local references.
- [ ] User can save valid BibTeX.
