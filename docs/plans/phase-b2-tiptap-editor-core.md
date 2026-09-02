# Phase B2 — TipTap Editor Core

**Summary:** Builds the WYSIWYG block editor on TipTap with H1-as-section semantics, workspace adapter for persistence, and section navigation with drag-to-reorder.

---

## Design Decisions

### Block ID Strategy

- **Migration:** SHA-256 of content (deterministic, compatible with ADR-019)
- **Editor-created blocks:** Random 8-char hex via `crypto.randomUUID()` (no collision risk)
- **Stability:** Once assigned, id is stable — no rehashing on content edit
- **File naming:** `<id>.qmd` (not `_block-<id>.qmd`)

### Section Node Semantics

- **Document structure:** `doc > section+ > heading + paragraph*`
- **Section node:** Custom TipTap node with `defining: true` (Enter at end creates new section)
- **H1 deletion:** Merge body content into previous section (not disallowed)
- **Copy-paste:** Creates new block with new random id (same content)

### Persistence

- **Workspace adapter interface** in `packages/workspace/` (implemented before editor)
- **MemoryWorkspace** for tests, **IndexedDBWorkspace** for production (OD-051)
- **Manifest sync:** Save updates `manifest.json` order, titles from H1, new/renamed ids

### Drag-to-Reorder

- **Library:** `@dnd-kit` (accessible, touch-friendly, React-native)
- **Integration:** Each Section NodeView renders a drag handle
- **Reorder:** Single ProseMirror transaction cutting and pasting section nodes

---

## B2-010 — Scaffold apps/web with Vite + React

### Atomic Instruction

Create the OpenDraft web application with Vite, React, TypeScript, and development tooling.

### Definition of Done

- [ ] `apps/web/` initialized with Vite React TypeScript template
- [ ] `package.json` with correct workspace protocol (`@opendraft/*` dependencies)
- [ ] `vite.config.ts` configured with path aliases
- [ ] `tsconfig.json` with strict mode and path aliases
- [ ] `index.html` entry point loading `src/main.tsx`
- [ ] `src/main.tsx` renders React root
- [ ] `src/App.tsx` renders minimal shell (header + main area)
- [ ] Development server starts with `npm run dev`
- [ ] Build succeeds with `npm run build`
- [ ] No `.gitignore` needed (root covers all patterns)

---

## B2-011 — Implement workspace adapter interface

### Atomic Instruction

Define the `WorkspaceAdapter` interface and in-memory implementation for testing.

### Definition of Done

- [ ] `packages/workspace/src/adapter.ts` exports `WorkspaceAdapter` interface:
  - `readFile(path: string): Promise<string | null>`
  - `writeFile(path: string, content: string): Promise<void>`
  - `deleteFile(path: string): Promise<void>`
  - `listFiles(dir: string): Promise<string[]>`
- [ ] `packages/workspace/src/memory.ts` exports `MemoryWorkspace` class implementing adapter
- [ ] `packages/workspace/src/index.ts` re-exports interface and implementations
- [ ] `packages/workspace/package.json` with workspace dependencies
- [ ] `packages/workspace/tsconfig.json` configured
- [ ] Unit tests cover all interface methods (create, read, update, delete, list)
- [ ] Unit tests verify `readFile` returns null for missing files
- [ ] Unit tests verify `listFiles` returns empty array for empty directory
- [ ] Tests pass with `vitest`

---

## B2-012 — Install TipTap and dependencies

### Atomic Instruction

Add TipTap packages and dnd-kit to the web application.

### Definition of Done

- [ ] `@tiptap/react` installed
- [ ] `@tiptap/pm` installed (ProseMirror core)
- [ ] `@tiptap/starter-kit` installed (basic extensions)
- [ ] `@tiptap/extension-placeholder` installed
- [ ] `@dnd-kit/core` installed
- [ ] `@dnd-kit/sortable` installed
- [ ] `@dnd-kit/utilities` installed
- [ ] All dependencies added to `apps/web/package.json`
- [ ] No version conflicts in `npm ls`

---

## B2-013 — Implement Section node extension

### Atomic Instruction

Create custom TipTap Section node with H1-as-title semantics and document structure.

### Definition of Done

- [ ] `packages/editor/src/extensions/section.ts` exports `Section` extension:
  - Node name: `section`
  - Content: `heading paragraph*` (H1 required, body optional)
  - Group: `block`
  - Defining: `true` (Enter at end creates new section)
  - ParseHTML: matches `div[data-section]`
  - RenderHTML: `['div', HTMLAttributes, 0]`
- [ ] `packages/editor/src/extensions/document.ts` overrides default Document:
  - Content: `section+` (one or more sections)
  - TopNode: `true`
- [ ] `packages/editor/src/extensions/index.ts` re-exports all extensions
- [ ] Unit tests verify Section node can be created
- [ ] Unit tests verify Section node renders with H1 + body content
- [ ] Unit tests verify Document node requires at least one Section
- [ ] Tests pass with `vitest`

---

## B2-014 — Implement H1 → Section split logic

### Atomic Instruction

Detect when a paragraph is converted to H1 and split the current section into two.

### Definition of Done

- [ ] `packages/editor/src/extensions/section-split.ts` exports plugin:
  - Detects paragraph→heading conversion in `appendTransaction`
  - Wraps heading + following content into new Section node
  - Preserves content after cursor in the new section
- [ ] TipTap command `splitSection()` available for programmatic use
- [ ] Unit tests verify: paragraph at start of section → convert to H1 → creates new section
- [ ] Unit tests verify: paragraph in middle of section → convert to H1 → splits content correctly
- [ ] Unit tests verify: content after cursor moves to new section
- [ ] Unit tests verify: first section can be split (creates two sections)
- [ ] Tests pass with `vitest`

---

## B2-015 — Implement H1 delete → section merge logic

### Atomic Instruction

When user deletes an H1 at the start of a section, merge body content into the previous section.

### Definition of Done

- [ ] `packages/editor/src/extensions/section-merge.ts` exports plugin:
  - Detects backspace at start of heading (first child of section)
  - Merges current section's body into previous section's body
  - Removes empty section after merge
- [ ] Unit tests verify: delete H1 in section 2 → content merges into section 1
- [ ] Unit tests verify: delete H1 in first section → no-op (no previous section)
- [ ] Unit tests verify: delete H1 when section has no body → section removed
- [ ] Unit tests verify: cursor position correct after merge
- [ ] Tests pass with `vitest`

---

## B2-016 — Implement Markdown serializer

### Atomic Instruction

Serialize TipTap document to per-section Markdown files and reconstruct from them.

### Definition of Done

- [ ] `packages/editor/src/serializer.ts` exports:
  - `serializeDocument(doc): Map<string, string>` — maps section id to Markdown content
  - `deserializeSections(sections: Map<string, string>): Node[]` — reconstructs sections from files
- [ ] Serialization produces valid Markdown per section (H1 + body)
- [ ] Deserialization parses Markdown into Section nodes with correct structure
- [ ] Round-trip test: serialize → deserialize → serialize produces identical output
- [ ] Round-trip test handles: paragraphs, emphasis, lists, hard breaks
- [ ] Round-trip test handles: multiple sections with different content
- [ ] Tests pass with `vitest`

---

## B2-017 — Implement Editor component

### Atomic Instruction

Create React component wrapping TipTap editor with Section extensions and workspace integration.

### Definition of Done

- [ ] `apps/web/src/components/Editor.tsx` exports `Editor` component:
  - Accepts `workspace: WorkspaceAdapter` and `manifestPath: string` props
  - Loads sections from workspace on mount
  - Renders TipTap editor with Section, Document, and basic extensions
  - Auto-saves on content change (debounced, 500ms)
  [ ] `apps/web/src/App.tsx` renders Editor with MemoryWorkspace (for development)
- [ ] Editor renders editable area with H1-as-section structure
- [ ] Basic typing works (paragraphs, emphasis, lists)
- [ ] H1 creation splits sections
- [ ] H1 deletion merges sections
- [ ] Component tests verify: editor renders with initial content
- [ ] Component tests verify: typing updates content
- [ ] Tests pass with `vitest`

---

## B2-018 — Implement section persistence with manifest sync

### Atomic Instruction

Save and load sections to workspace files, maintaining manifest.json consistency.

### Definition of Done

- [ ] `apps/web/src/persistence.ts` exports:
  - `saveSections(workspace, manifestPath, sections)` — writes `<id>.qmd` files and updates `manifest.json`
  - `loadSections(workspace, manifestPath)` — reads manifest and loads all section files
  - `createSection(workspace, manifestPath, title)` — creates new section file and manifest entry
  - `deleteSection(workspace, manifestPath, sectionId)` — removes file and manifest entry
  - `reorderSections(workspace, manifestPath, orderedIds)` — updates manifest order
- [ ] `manifest.json` format matches schema:
  ```json
  { "version": "1.0.0", "blocks": [{ "id": "<id>", "file": "<id>.qmd", "title": "H1 text" }] }
  ```
- [ ] Save updates titles from H1 content
- [ ] Round-trip test: load → edit → save → load produces identical editor state
- [ ] Round-trip test: create → save → load → verify new section exists
- [ ] Round-trip test: delete → save → load → verify section removed
- [ ] Round-trip test: reorder → save → load → verify manifest order matches
- [ ] All I/O uses WorkspaceAdapter (mockable in tests)
- [ ] Tests pass with `vitest`

---

## B2-019 — Implement Section sidebar

### Atomic Instruction

Create sidebar listing sections in manifest order with jump-to-section navigation.

### Definition of Done

- [ ] `apps/web/src/components/SectionSidebar.tsx` exports `SectionSidebar` component:
  - Accepts `editor: Editor` prop
  - Lists all sections (H1 title as label) in document order
  - Highlights active section based on cursor position
  - Click on section scrolls/jumps to that section in editor
- [ ] `apps/web/src/App.tsx` renders sidebar alongside Editor
- [ ] Sidebar updates when sections are created/deleted
- [ ] Sidebar updates when section titles change
- [ ] Active section highlights as cursor moves between sections
- [ ] Component tests verify: sidebar lists all sections with correct titles
- [ ] Component tests verify: click on section updates editor selection
- [ ] Component tests verify: sidebar updates after section create/delete
- [ ] Tests pass with `vitest`

---

## B2-020 — Implement drag-to-reorder

### Atomic Instruction

Add drag handles to sections and reorder via drag-and-drop.

### Definition of Done

- [ ] `apps/web/src/components/DragHandle.tsx` exports `DragHandle` component:
  - Renders grab handle icon (⠿ or similar)
  - Uses `@dnd-kit/sortable` hook for drag behavior
  - Accessible via keyboard (Space/Enter to grab, Arrow keys to move)
- [ ] Section NodeView renders DragHandle component
- [ ] `apps/web/src/components/SectionSidebar.tsx` supports drag-to-reorder:
  - `DndContext` wrapper with `SortableContext`
  - `onDragEnd` handler calls editor command to reorder sections
- [ ] Editor command `reorderSections(fromIndex, toIndex)` available
- [ ] Reorder updates document structure (sections move in ProseMirror doc)
- [ ] Reorder triggers save (manifest order updates)
- [ ] Component tests verify: drag section 2 before section 1 → order changes
- [ ] Component tests verify: reorder persists to manifest
- [ ] Component tests verify: keyboard reordering works
- [ ] Tests pass with `vitest`

---

## Implementation Order

1. **B2-010** — Scaffold apps/web (prerequisite for all)
2. **B2-011** — Workspace adapter (foundation for persistence)
3. **B2-012** — Install TipTap + dnd-kit (dependencies)
4. **B2-013** — Section node extension (core editor structure)
5. **B2-014** — H1 → Section split (core interaction)
6. **B2-015** — H1 delete → merge (core interaction)
7. **B2-016** — Markdown serializer (round-trip support)
8. **B2-017** — Editor component (React integration)
9. **B2-018** — Section persistence (manifest sync)
10. **B2-019** — Section sidebar (navigation)
11. **B2-020** — Drag-to-reorder (reorder UX)

---

## Dependencies

```
B2-010 (scaffold)
  └── B2-011 (workspace adapter)
        └── B2-012 (install deps)
              ├── B2-013 (section node)
              │     ├── B2-014 (split logic)
              │     ├── B2-015 (merge logic)
              │     └── B2-016 (serializer)
              └── B2-017 (editor component)
                    ├── B2-018 (persistence)
                    ├── B2-019 (sidebar)
                    └── B2-020 (drag-to-reorder)
```

---

## Technical Notes

### ProseMirror Schema

```typescript
{
  doc: { content: "section+" },
  section: { 
    content: "heading paragraph*", 
    group: "block",
    defining: true,
  },
  heading: { content: "inline*", marks: "_", group: "block", attrs: { level: { default: 1 } } },
  paragraph: { content: "inline*", marks: "_", group: "block" },
  text: { inline: true },
  hardBreak: { inline: true, group: "inline" },
}
```

### Block ID Generation

```typescript
// Migration: deterministic from content
function migrationId(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 8);
}

// Editor: random, collision-free
function generateBlockId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}
```

### Manifest Format

```json
{
  "version": "1.0.0",
  "blocks": [
    { "id": "a1b2c3d4", "file": "a1b2c3d4.qmd", "title": "Introduction" },
    { "id": "e5f6g7h8", "file": "e5f6g7h8.qmd", "title": "Methods" }
  ]
}
```

### Package Structure

```
packages/
  workspace/       # B2-011
  editor/          # B2-013 through B2-016
apps/
  web/             # B2-010, B2-017 through B2-020
```
