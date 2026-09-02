# Phase B2 — Remaining Tasks: Atomic Instructions

**Summary:** Atomic instructions for implementing the remaining B2 tasks (B2-010, B2-017 through B2-020) after core editor package completion.

---

## Completed Tasks (Reference)

- **B2-011**: WorkspaceAdapter interface + MemoryWorkspace ✓
- **B2-013**: Section and SectionDocument node extensions ✓
- **B2-014**: SectionSplit extension ✓
- **B2-015**: SectionMerge extension ✓
- **B2-016**: Markdown serializer ✓

---

## B2-010 — Scaffold apps/web with Vite + React

### Pre-conditions

- Node.js >= 20 available
- pnpm available for package management
- Root `package.json` uses `"type": "module"`

### Atomic Instructions

**Step 1: Create package.json**

Create `apps/web/package.json` with:
```json
{
  "name": "@opendraft/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@opendraft/workspace": "workspace:*",
    "@opendraft/editor": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "^6.0.3",
    "vite": "^6.0.0",
    "vitest": "^4.1.11",
    "jsdom": "^25.0.0"
  }
}
```

**Step 2: Create vite.config.ts**

Create `apps/web/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

**Step 3: Create tsconfig.json**

Create `apps/web/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "types": ["node"],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `apps/web/tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

**Step 4: Create index.html**

Create `apps/web/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OpenDraft</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 5: Create src/main.tsx**

Create `apps/web/src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 6: Create src/App.tsx**

Create `apps/web/src/App.tsx`:
```tsx
export function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{ padding: '1rem', borderBottom: '1px solid #ccc' }}>
        <h1>OpenDraft</h1>
      </header>
      <main style={{ flex: 1, padding: '1rem' }}>
        <p>Editor will be here</p>
      </main>
    </div>
  );
}

export default App;
```

**Step 7: Run pnpm install**

```bash
pnpm install
```

**Step 8: Verify dev server starts**

```bash
cd apps/web && pnpm dev
```

Verify: http://localhost:5173 shows "OpenDraft" header.

**Step 9: Verify build succeeds**

```bash
cd apps/web && pnpm build
```

### Definition of Done

- [ ] `apps/web/package.json` exists with correct dependencies
- [ ] `apps/web/vite.config.ts` configured with React plugin and path aliases
- [ ] `apps/web/tsconfig.json` with strict mode and jsx: react-jsx
- [ ] `apps/web/index.html` loads `src/main.tsx`
- [ ] `apps/web/src/main.tsx` renders React root
- [ ] `apps/web/src/App.tsx` renders header + main area
- [ ] `pnpm dev` starts development server
- [ ] `pnpm build` succeeds without errors
- [ ] No `.gitignore` needed (root covers all patterns)

---

## B2-017 — Implement Editor component

### Pre-conditions

- B2-010 complete (apps/web scaffolded)
- B2-013 complete (Section extension available)
- B2-014 complete (SectionSplit extension available)
- B2-015 complete (SectionMerge extension available)
- `@tiptap/react` installed in apps/web

### Atomic Instructions

**Step 1: Install TipTap React dependencies**

Add to `apps/web/package.json` dependencies:
```json
{
  "@tiptap/react": "^2.24.0",
  "@tiptap/pm": "^2.24.0",
  "@tiptap/starter-kit": "^2.24.0",
  "@tiptap/extension-placeholder": "^2.24.0"
}
```

Run `pnpm install`.

**Step 2: Create Editor component**

Create `apps/web/src/components/Editor.tsx`:

```tsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Section, SectionDocument, SectionSplit, SectionMerge } from '@opendraft/editor';
import type { WorkspaceAdapter } from '@opendraft/workspace';

interface EditorProps {
  workspace: WorkspaceAdapter;
  manifestPath: string;
  initialContent?: string;
  onSave?: (content: string) => void;
}

export function Editor({ workspace, manifestPath, initialContent, onSave }: EditorProps) {
  const editor = useEditor({
    extensions: [
      SectionDocument,
      Section,
      SectionSplit,
      SectionMerge,
      StarterKit.configure({ document: false }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
    ],
    content: initialContent || '<div data-section><h1>Title</h1><p></p></div>',
    onUpdate: ({ editor }) => {
      // Auto-save will be handled by parent component
      if (onSave) {
        onSave(editor.getHTML());
      }
    },
  });

  if (!editor) {
    return <div>Loading editor...</div>;
  }

  return (
    <div className="editor-container">
      <EditorContent editor={editor} />
    </div>
  );
}

export default Editor;
```

**Step 3: Update App.tsx to use Editor**

Update `apps/web/src/App.tsx`:

```tsx
import { useState } from 'react';
import { Editor } from './components/Editor';
import { MemoryWorkspace } from '@opendraft/workspace';

const workspace = new MemoryWorkspace();

export function App() {
  const [savedContent, setSavedContent] = useState<string | null>(null);

  const handleSave = (content: string) => {
    setSavedContent(content);
    console.log('Saved:', content);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{ padding: '1rem', borderBottom: '1px solid #ccc' }}>
        <h1>OpenDraft</h1>
      </header>
      <main style={{ flex: 1, display: 'flex' }}>
        <aside style={{ width: '250px', borderRight: '1px solid #ccc', padding: '1rem' }}>
          <h2>Sections</h2>
          {/* Sidebar will go here */}
        </aside>
        <div style={{ flex: 1, padding: '1rem' }}>
          <Editor
            workspace={workspace}
            manifestPath="blocks/manifest.json"
            onSave={handleSave}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
```

**Step 4: Add basic CSS**

Create `apps/web/src/index.css`:
```css
.editor-container {
  max-width: 800px;
  margin: 0 auto;
}

.editor-container .ProseMirror {
  outline: none;
  min-height: 400px;
  padding: 1rem;
}

.editor-container .ProseMirror p.is-editor-empty:first-child::before {
  color: #adb5bd;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

.editor-container section {
  margin-bottom: 2rem;
  padding: 1rem;
  border: 1px solid #eee;
  border-radius: 4px;
}

.editor-container section h1 {
  margin-top: 0;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #eee;
}
```

Import in `main.tsx`:
```tsx
import './index.css';
```

**Step 5: Create component test**

Create `apps/web/src/components/Editor.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Editor } from './Editor';
import { MemoryWorkspace } from '@opendraft/workspace';

// @vitest-environment jsdom

describe('Editor component', () => {
  it('renders editor with initial content', () => {
    const workspace = new MemoryWorkspace();
    render(
      <Editor
        workspace={workspace}
        manifestPath="test/manifest.json"
        initialContent='<div data-section><h1>Test Title</h1><p>Test content</p></div>'
      />
    );

    expect(screen.getByText('Test Title')).toBeDefined();
  });

  it('renders loading state when editor not ready', () => {
    const workspace = new MemoryWorkspace();
    render(
      <Editor
        workspace={workspace}
        manifestPath="test/manifest.json"
      />
    );

    // Editor should render (either loading or content)
    expect(document.querySelector('.editor-container')).toBeDefined();
  });
});
```

**Step 6: Run tests**

```bash
cd apps/web && pnpm test
```

### Definition of Done

- [ ] `apps/web/src/components/Editor.tsx` exports Editor component
- [ ] Editor accepts workspace and manifestPath props
- [ ] Editor renders TipTap with Section extensions
- [ ] Editor supports initialContent prop
- [ ] Editor calls onSave callback on content change
- [ ] App.tsx renders Editor with MemoryWorkspace
- [ ] Basic styling applied
- [ ] Component tests pass
- [ ] Dev server shows working editor

---

## B2-018 — Implement section persistence with manifest sync

### Pre-conditions

- B2-011 complete (WorkspaceAdapter available)
- B2-016 complete (serializer available)
- B2-017 complete (Editor component available)

### Atomic Instructions

**Step 1: Create persistence module**

Create `apps/web/src/persistence.ts`:

```typescript
import type { WorkspaceAdapter } from '@opendraft/workspace';

interface ManifestBlock {
  id: string;
  file: string;
  title: string;
}

interface Manifest {
  version: string;
  blocks: ManifestBlock[];
}

/**
 * Generate a random 8-char hex block ID.
 */
function generateBlockId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}

/**
 * Save sections to workspace files and update manifest.
 */
export async function saveSections(
  workspace: WorkspaceAdapter,
  manifestPath: string,
  sections: Array<{ id: string; title: string; content: string }>
): Promise<void> {
  const dir = manifestPath.replace(/manifest\.json$/, '');

  // Write each section file
  for (const section of sections) {
    const filePath = `${dir}${section.id}.qmd`;
    await workspace.writeFile(filePath, `# ${section.title}\n\n${section.content}`);
  }

  // Delete removed files
  const existingFiles = await workspace.listFiles(dir);
  const currentIds = new Set(sections.map(s => s.id));

  for (const file of existingFiles) {
    if (file.endsWith('.qmd')) {
      const fileId = file.replace('.qmd', '');
      if (!currentIds.has(fileId)) {
        await workspace.deleteFile(`${dir}${file}`);
      }
    }
  }

  // Write manifest
  const manifest: Manifest = {
    version: '1.0.0',
    blocks: sections.map(s => ({
      id: s.id,
      file: `${s.id}.qmd`,
      title: s.title,
    })),
  };

  await workspace.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * Load sections from workspace.
 */
export async function loadSections(
  workspace: WorkspaceAdapter,
  manifestPath: string
): Promise<Array<{ id: string; title: string; content: string }>> {
  const manifestContent = await workspace.readFile(manifestPath);
  if (!manifestContent) {
    return [];
  }

  const manifest: Manifest = JSON.parse(manifestContent);
  const dir = manifestPath.replace(/manifest\.json$/, '');
  const sections: Array<{ id: string; title: string; content: string }> = [];

  for (const block of manifest.blocks) {
    const filePath = `${dir}${block.file}`;
    const content = await workspace.readFile(filePath);

    if (content) {
      // Parse markdown: skip first line (heading)
      const lines = content.split('\n');
      const body = lines.slice(2).join('\n').trim();
      sections.push({
        id: block.id,
        title: block.title,
        content: body,
      });
    }
  }

  return sections;
}

/**
 * Create a new section.
 */
export async function createSection(
  workspace: WorkspaceAdapter,
  manifestPath: string,
  title: string,
  content: string = ''
): Promise<string> {
  const dir = manifestPath.replace(/manifest\.json$/, '');

  // Load existing manifest
  const manifestContent = await workspace.readFile(manifestPath);
  const manifest: Manifest = manifestContent
    ? JSON.parse(manifestContent)
    : { version: '1.0.0', blocks: [] };

  // Generate new ID
  const id = generateBlockId();

  // Write section file
  const filePath = `${dir}${id}.qmd`;
  await workspace.writeFile(filePath, `# ${title}\n\n${content}`);

  // Update manifest
  manifest.blocks.push({ id, file: `${id}.qmd`, title });
  await workspace.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  return id;
}

/**
 * Delete a section.
 */
export async function deleteSection(
  workspace: WorkspaceAdapter,
  manifestPath: string,
  sectionId: string
): Promise<void> {
  const dir = manifestPath.replace(/manifest\.json$/, '');

  // Delete section file
  const filePath = `${dir}${sectionId}.qmd`;
  await workspace.deleteFile(filePath);

  // Update manifest
  const manifestContent = await workspace.readFile(manifestPath);
  if (manifestContent) {
    const manifest: Manifest = JSON.parse(manifestContent);
    manifest.blocks = manifest.blocks.filter(b => b.id !== sectionId);
    await workspace.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  }
}

/**
 * Reorder sections in manifest.
 */
export async function reorderSections(
  workspace: WorkspaceAdapter,
  manifestPath: string,
  orderedIds: string[]
): Promise<void> {
  const manifestContent = await workspace.readFile(manifestPath);
  if (!manifestContent) return;

  const manifest: Manifest = JSON.parse(manifestContent);
  const blockMap = new Map(manifest.blocks.map(b => [b.id, b]));

  manifest.blocks = orderedIds
    .map(id => blockMap.get(id))
    .filter((b): b is ManifestBlock => b !== undefined);

  await workspace.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}
```

**Step 2: Create persistence tests**

Create `apps/web/src/persistence.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import {
  saveSections,
  loadSections,
  createSection,
  deleteSection,
  reorderSections,
} from './persistence';

describe('persistence', () => {
  let workspace: MemoryWorkspace;

  beforeEach(() => {
    workspace = new MemoryWorkspace();
  });

  describe('saveSections', () => {
    it('creates section files and manifest', async () => {
      const sections = [
        { id: 'abc12345', title: 'Introduction', content: 'Hello world' },
        { id: 'def67890', title: 'Methods', content: 'Method details' },
      ];

      await saveSections(workspace, 'blocks/manifest.json', sections);

      const manifest = await workspace.readFile('blocks/manifest.json');
      expect(manifest).toBeDefined();

      const parsed = JSON.parse(manifest!);
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.blocks).toHaveLength(2);
      expect(parsed.blocks[0].id).toBe('abc12345');
      expect(parsed.blocks[0].title).toBe('Introduction');

      const file1 = await workspace.readFile('blocks/abc12345.qmd');
      expect(file1).toContain('# Introduction');
      expect(file1).toContain('Hello world');
    });

    it('removes deleted section files', async () => {
      // Create initial sections
      await workspace.writeFile('blocks/old.qmd', '# Old');
      await saveSections(workspace, 'blocks/manifest.json', [
        { id: 'new', title: 'New', content: 'Content' },
      ]);

      const files = await workspace.listFiles('blocks/');
      expect(files).not.toContain('old.qmd');
    });
  });

  describe('loadSections', () => {
    it('loads sections from workspace', async () => {
      await workspace.writeFile('blocks/manifest.json', JSON.stringify({
        version: '1.0.0',
        blocks: [{ id: 'abc', file: 'abc.qmd', title: 'Title' }],
      }));
      await workspace.writeFile('blocks/abc.qmd', '# Title\n\nContent');

      const sections = await loadSections(workspace, 'blocks/manifest.json');
      expect(sections).toHaveLength(1);
      expect(sections[0].title).toBe('Title');
      expect(sections[0].content).toBe('Content');
    });

    it('returns empty array for missing manifest', async () => {
      const sections = await loadSections(workspace, 'blocks/manifest.json');
      expect(sections).toEqual([]);
    });
  });

  describe('createSection', () => {
    it('creates new section and updates manifest', async () => {
      const id = await createSection(workspace, 'blocks/manifest.json', 'New Section');

      expect(id).toMatch(/^[a-f0-9]{8}$/);

      const manifest = JSON.parse(await workspace.readFile('blocks/manifest.json')!);
      expect(manifest.blocks).toHaveLength(1);
      expect(manifest.blocks[0].title).toBe('New Section');

      const file = await workspace.readFile(`blocks/${id}.qmd`);
      expect(file).toContain('# New Section');
    });
  });

  describe('deleteSection', () => {
    it('removes section file and manifest entry', async () => {
      await saveSections(workspace, 'blocks/manifest.json', [
        { id: 'abc', title: 'A', content: '' },
        { id: 'def', title: 'B', content: '' },
      ]);

      await deleteSection(workspace, 'blocks/manifest.json', 'abc');

      const manifest = JSON.parse(await workspace.readFile('blocks/manifest.json')!);
      expect(manifest.blocks).toHaveLength(1);
      expect(manifest.blocks[0].id).toBe('def');

      const file = await workspace.readFile('blocks/abc.qmd');
      expect(file).toBeNull();
    });
  });

  describe('reorderSections', () => {
    it('reorders sections in manifest', async () => {
      await saveSections(workspace, 'blocks/manifest.json', [
        { id: 'abc', title: 'A', content: '' },
        { id: 'def', title: 'B', content: '' },
        { id: 'ghi', title: 'C', content: '' },
      ]);

      await reorderSections(workspace, 'blocks/manifest.json', ['ghi', 'abc', 'def']);

      const manifest = JSON.parse(await workspace.readFile('blocks/manifest.json')!);
      expect(manifest.blocks.map((b: { id: string }) => b.id)).toEqual(['ghi', 'abc', 'def']);
    });
  });
});
```

**Step 3: Run tests**

```bash
cd apps/web && pnpm test
```

### Definition of Done

- [ ] `apps/web/src/persistence.ts` exports all functions
- [ ] `saveSections` writes files and updates manifest
- [ ] `loadSections` reads manifest and loads sections
- [ ] `createSection` generates ID and creates file
- [ ] `deleteSection` removes file and manifest entry
- [ ] `reorderSections` updates manifest order
- [ ] All functions use WorkspaceAdapter
- [ ] Unit tests pass

---

## B2-019 — Implement Section sidebar

### Pre-conditions

- B2-017 complete (Editor component available)
- B2-018 complete (persistence module available)

### Atomic Instructions

**Step 1: Create SectionSidebar component**

Create `apps/web/src/components/SectionSidebar.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';

interface Section {
  id: string;
  title: string;
  position: number;
}

interface SectionSidebarProps {
  editor: Editor;
  onSectionClick?: (position: number) => void;
}

export function SectionSidebar({ editor, onSectionClick }: SectionSidebarProps) {
  const [sections, setSections] = useState<Section[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  // Extract sections from editor document
  const extractSections = useCallback(() => {
    const { doc } = editor.state;
    const result: Section[] = [];

    doc.descendants((node, pos) => {
      if (node.type.name === 'section') {
        const heading = node.child(0);
        if (heading?.type.name === 'heading') {
          result.push({
            id: `section-${result.length}`,
            title: heading.textContent,
            position: pos,
          });
        }
      }
    });

    setSections(result);
  }, [editor]);

  // Update sections on document change
  useEffect(() => {
    extractSections();

    editor.on('update', extractSections);
    return () => {
      editor.off('update', extractSections);
    };
  }, [editor, extractSections]);

  // Track active section based on cursor
  useEffect(() => {
    const handler = () => {
      const { selection } = editor.state;
      const { $from } = selection;

      // Find which section the cursor is in
      for (let depth = $from.depth; depth >= 0; depth--) {
        if ($from.node(depth).type.name === 'section') {
          const sectionPos = $from.before(depth);
          const index = sections.findIndex(s => s.position === sectionPos);
          if (index >= 0) {
            setActiveIndex(index);
          }
          break;
        }
      }
    };

    editor.on('selectionUpdate', handler);
    return () => {
      editor.off('selectionUpdate', handler);
    };
  }, [editor, sections]);

  const handleClick = (position: number) => {
    editor.chain()
      .focus()
      .command(({ tr, dispatch }) => {
        if (dispatch) {
          const $pos = tr.doc.resolve(position + 1);
          tr.setSelection(
            editor.state.schema.nodeSelection($pos)
          );
        }
        return true;
      })
      .run();

    onSectionClick?.(position);
  };

  return (
    <nav className="section-sidebar">
      <h2>Sections</h2>
      <ul>
        {sections.map((section, index) => (
          <li
            key={section.id}
            className={index === activeIndex ? 'active' : ''}
            onClick={() => handleClick(section.position)}
          >
            {section.title}
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default SectionSidebar;
```

**Step 2: Add sidebar styles**

Add to `apps/web/src/index.css`:

```css
.section-sidebar {
  padding: 1rem;
}

.section-sidebar h2 {
  margin-top: 0;
  font-size: 1rem;
  color: #666;
}

.section-sidebar ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.section-sidebar li {
  padding: 0.5rem;
  cursor: pointer;
  border-radius: 4px;
  margin-bottom: 0.25rem;
}

.section-sidebar li:hover {
  background: #f0f0f0;
}

.section-sidebar li.active {
  background: #e0e7ff;
  color: #3730a3;
}
```

**Step 3: Update App.tsx to use sidebar**

Update `apps/web/src/App.tsx`:

```tsx
import { useState, useRef } from 'react';
import type { Editor as EditorType } from '@tiptap/core';
import { Editor } from './components/Editor';
import { SectionSidebar } from './components/SectionSidebar';
import { MemoryWorkspace } from '@opendraft/workspace';

const workspace = new MemoryWorkspace();

export function App() {
  const editorRef = useRef<EditorType | null>(null);
  const [savedContent, setSavedContent] = useState<string | null>(null);

  const handleSave = (content: string) => {
    setSavedContent(content);
  };

  const handleEditorReady = (editor: EditorType) => {
    editorRef.current = editor;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{ padding: '1rem', borderBottom: '1px solid #ccc' }}>
        <h1>OpenDraft</h1>
      </header>
      <main style={{ flex: 1, display: 'flex' }}>
        <aside style={{ width: '250px', borderRight: '1px solid #ccc' }}>
          {editorRef.current && (
            <SectionSidebar editor={editorRef.current} />
          )}
        </aside>
        <div style={{ flex: 1, padding: '1rem' }}>
          <Editor
            workspace={workspace}
            manifestPath="blocks/manifest.json"
            onSave={handleSave}
            onEditorReady={handleEditorReady}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
```

**Step 4: Update Editor component to expose editor instance**

Update `apps/web/src/components/Editor.tsx` to add `onEditorReady` prop:

```tsx
interface EditorProps {
  workspace: WorkspaceAdapter;
  manifestPath: string;
  initialContent?: string;
  onSave?: (content: string) => void;
  onEditorReady?: (editor: Editor) => void;
}

// In component:
useEffect(() => {
  if (editor && onEditorReady) {
    onEditorReady(editor);
  }
}, [editor, onEditorReady]);
```

**Step 5: Create component test**

Create `apps/web/src/components/SectionSidebar.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SectionSidebar } from './SectionSidebar';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Section, SectionDocument } from '@opendraft/editor';

// @vitest-environment jsdom

function createEditor(content: string) {
  return new Editor({
    extensions: [
      SectionDocument,
      Section,
      StarterKit.configure({ document: false }),
    ],
    content,
  });
}

describe('SectionSidebar', () => {
  it('lists sections from editor', () => {
    const editor = createEditor(
      '<div data-section><h1>First</h1><p>A</p></div>' +
      '<div data-section><h1>Second</h1><p>B</p></div>'
    );

    render(<SectionSidebar editor={editor} />);

    expect(screen.getByText('First')).toBeDefined();
    expect(screen.getByText('Second')).toBeDefined();
  });

  it('highlights active section', () => {
    const editor = createEditor(
      '<div data-section><h1>First</h1><p>A</p></div>' +
      '<div data-section><h1>Second</h1><p>B</p></div>'
    );

    render(<SectionSidebar editor={editor} />);

    const items = screen.getAllByRole('listitem');
    expect(items[0].className).toContain('active');
  });
});
```

**Step 6: Run tests**

```bash
cd apps/web && pnpm test
```

### Definition of Done

- [ ] `apps/web/src/components/SectionSidebar.tsx` exports SectionSidebar component
- [ ] Sidebar lists all sections with H1 titles
- [ ] Sidebar highlights active section based on cursor
- [ ] Click on section scrolls/jumps to that section
- [ ] Sidebar updates when sections change
- [ ] App.tsx renders sidebar alongside Editor
- [ ] Component tests pass

---

## B2-020 — Implement drag-to-reorder

### Pre-conditions

- B2-019 complete (SectionSidebar available)
- `@dnd-kit` packages installed

### Atomic Instructions

**Step 1: Install dnd-kit dependencies**

Add to `apps/web/package.json` dependencies:
```json
{
  "@dnd-kit/core": "^6.0.0",
  "@dnd-kit/sortable": "^8.0.0",
  "@dnd-kit/utilities": "^3.0.0"
}
```

Run `pnpm install`.

**Step 2: Create DragHandle component**

Create `apps/web/src/components/DragHandle.tsx`:

```tsx
import { forwardRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface DragHandleProps {
  id: string;
  index: number;
}

export const DragHandle = forwardRef<HTMLButtonElement, DragHandleProps>(
  ({ id, index }, ref) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <button
        ref={(node) => {
          setNodeRef(node);
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        className="drag-handle"
        style={style}
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder section ${index + 1}`}
      >
        ⠿
      </button>
    );
  }
);

DragHandle.displayName = 'DragHandle';
```

**Step 3: Add drag handle styles**

Add to `apps/web/src/index.css`:

```css
.drag-handle {
  background: none;
  border: none;
  cursor: grab;
  padding: 0.25rem;
  color: #999;
  font-size: 1.2rem;
}

.drag-handle:hover {
  color: #333;
}

.drag-handle:active {
  cursor: grabbing;
}

.section-sidebar li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
```

**Step 4: Update SectionSidebar with drag-to-reorder**

Update `apps/web/src/components/SectionSidebar.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { DragHandle } from './DragHandle';

// ... existing interfaces ...

export function SectionSidebar({ editor, onSectionClick }: SectionSidebarProps) {
  // ... existing state ...

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex(s => s.id === active.id);
      const newIndex = sections.findIndex(s => s.id === over.id);

      const newSections = arrayMove(sections, oldIndex, newIndex);
      setSections(newSections);

      // Reorder in editor
      editor.chain()
        .command(({ tr, dispatch }) => {
          if (dispatch) {
            // Get all section nodes
            const sections Nodes: Array<{ node: Node; pos: number }> = [];
            editor.state.doc.descendants((node, pos) => {
              if (node.type.name === 'section') {
                sectionsNodes.push({ node, pos });
              }
            });

            // Apply new order
            const newOrder = newSections.map(s =>
              sectionsNodes.find(ns => ns.pos === s.position)
            ).filter(Boolean);

            // Replace all sections
            const firstPos = sectionsNodes[0]?.pos ?? 0;
            const lastPos = sectionsNodes[sectionsNodes.length - 1];
            const endPos = lastPos ? lastPos.pos + lastPos.node.nodeSize : 0;

            tr.replaceWith(firstPos, endPos, newOrder.map(ns => ns!.node));
          }
          return true;
        })
        .run();
    }
  };

  return (
    <nav className="section-sidebar">
      <h2>Sections</h2>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sections.map(s => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul>
            {sections.map((section, index) => (
              <li
                key={section.id}
                className={index === activeIndex ? 'active' : ''}
              >
                <DragHandle id={section.id} index={index} />
                <span onClick={() => handleClick(section.position)}>
                  {section.title}
                </span>
              </li>
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </nav>
  );
}
```

**Step 5: Create reorder command in editor package**

Add to `packages/editor/src/extensions/section-reorder.ts`:

```typescript
import { Extension } from '@tiptap/core';
import type { Node } from 'prosemirror-model';
import type { RawCommands } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sectionReorder: {
      /**
       * Reorder sections in the document.
       */
      reorderSections: (fromIndex: number, toIndex: number) => ReturnType;
    };
  }
}

export const SectionReorder = Extension.create({
  name: 'sectionReorder',

  addCommands() {
    return {
      reorderSections:
        (fromIndex, toIndex) =>
        ({ state, dispatch }) => {
          const { doc } = state;

          // Collect all sections
          const sections: Node[] = [];
          doc.descendants((node) => {
            if (node.type.name === 'section') {
              sections.push(node);
            }
          });

          // Validate indices
          if (fromIndex < 0 || fromIndex >= sections.length) return false;
          if (toIndex < 0 || toIndex >= sections.length) return false;
          if (fromIndex === toIndex) return false;

          if (dispatch) {
            const tr = state.tr;

            // Calculate positions
            let pos = 0;
            const positions = sections.map((section) => {
              const start = pos;
              pos += section.nodeSize;
              return start;
            });

            // Reorder
            const reordered = [...sections];
            const [moved] = reordered.splice(fromIndex, 1);
            reordered.splice(toIndex, 0, moved);

            // Replace all sections
            const endPos = positions[positions.length - 1] + sections[sections.length - 1].nodeSize;
            tr.replaceWith(0, endPos, reordered);

            dispatch(tr);
          }

          return true;
        },
    } as Partial<RawCommands>;
  },
});
```

Update `packages/editor/src/index.ts` to export:
```typescript
export { SectionReorder } from './extensions/section-reorder.js';
```

**Step 6: Update Editor to use SectionReorder**

Update `apps/web/src/components/Editor.tsx`:

```tsx
import { Section, SectionDocument, SectionSplit, SectionMerge, SectionReorder } from '@opendraft/editor';

// In extensions array:
extensions: [
  SectionDocument,
  Section,
  SectionSplit,
  SectionMerge,
  SectionReorder,
  StarterKit.configure({ document: false }),
  // ...
],
```

**Step 7: Create component test**

Create `apps/web/src/components/DragHandle.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { DragHandle } from './DragHandle';

// @vitest-environment jsdom

describe('DragHandle', () => {
  it('renders drag handle button', () => {
    render(
      <DndContext>
        <DragHandle id="test-1" index={0} />
      </DndContext>
    );

    const button = screen.getByRole('button');
    expect(button).toBeDefined();
    expect(button.getAttribute('aria-label')).toContain('section 1');
  });
});
```

**Step 8: Run all tests**

```bash
cd apps/web && pnpm test
npx vitest run packages/editor/tests/
```

### Definition of Done

- [ ] `@dnd-kit` packages installed
- [ ] `apps/web/src/components/DragHandle.tsx` exports DragHandle component
- [ ] DragHandle renders grab handle icon
- [ ] DragHandle is accessible via keyboard
- [ ] SectionReorder extension created in packages/editor
- [ ] SectionSidebar supports drag-to-reorder
- [ ] Reorder updates document structure
- [ ] Component tests pass

---

## Implementation Order

1. **B2-010** — Scaffold apps/web
2. **B2-017** — Editor component
3. **B2-018** — Section persistence
4. **B2-019** — Section sidebar
5. **B2-020** — Drag-to-reorder

## Dependencies

```
B2-010 (scaffold)
  └── B2-017 (editor component)
        ├── B2-018 (persistence)
        └── B2-019 (sidebar)
              └── B2-020 (drag-to-reorder)
```

## Verification

After completing all tasks:

```bash
# Run all tests
pnpm test

# Verify dev server
cd apps/web && pnpm dev

# Verify build
cd apps/web && pnpm build
```
