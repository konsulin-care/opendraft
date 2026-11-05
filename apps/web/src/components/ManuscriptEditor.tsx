import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useEditor } from '@milkdown/react';
import type { Editor } from '@milkdown/kit/core';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import type { CitationState } from '../citation/types';
import { EditorSurface } from './EditorSurface';
import { useFocusScrollGuard } from '../hooks/useFocusScrollGuard';
import { useSaveShortcut } from '../hooks/useSaveShortcut';
import { SourceEditor, type SourceEditorHandle } from './SourceEditor';
import { EditorFrame } from './editor-frame';
import { createModeSwitcher, useInitialCaret, type EditorTestApi } from '../caret-mode-switch';
import { isManuscriptArticlePath, resolveEditorGate } from '../project/file-capability';
import { BlockEditor } from '../block-editor/BlockEditor';
import { useDebouncedSaver } from './editor/autosave';
import { createCrepeConfig, useEditorWiring } from './crepe-config';
import { MetadataPanel, manuscriptRootFromPath } from './metadata-panel/MetadataPanel';
import type { SaveStatus } from './AppHeader';

export type { EditorTestApi } from '../caret-mode-switch';

interface ManuscriptEditorProps {
  /** Workspace adapter used for autosave persistence. */
  workspace: WorkspaceAdapter;
  /** Initial markdown content; must be ready before mount. */
  defaultValue: string;
  /** Workspace path this editor autosaves to; pending edits flush to the old path on change. */
  path: string;
  /** Called once the editor instance is ready (rich/block files only). */
  onEditorReady?: (api: EditorTestApi) => void;
  /** Editing mode: 'wysiwyg' (default) or 'source' (raw markdown). */
  mode?: 'wysiwyg' | 'source';
  /** Reports autosave progress: saving, saved, or error. */
  onSaveStatusChange?: (status: SaveStatus) => void;
  /** Formatting-toolbar visibility preference, owned by the app shell. */
  formattingToolbar?: boolean;
  /** Project identifier used to persist metadata-panel state per project. */
  projectId?: string;
  /** Repo-relative path of the active block file; drives expand-and-scroll in the assembly. */
  activeBlockPath?: string;
}

interface UseManuscriptStateOptions {
  workspace: WorkspaceAdapter;
  defaultValue: string;
  path: string;
  mode: 'wysiwyg' | 'source';
  onEditorReady?: (api: EditorTestApi) => void;
  onSaveStatusChange?: (status: SaveStatus) => void;
}

/** Props shared by the rich and source-only editor variants. */
interface FileEditorProps extends UseManuscriptStateOptions {
  formattingToolbar: boolean;
  projectId: string;
}

/**
 * Render the metadata panel for files under `manuscripts/<id>/`;
 * null for every other path.
 *
 * @param workspace - Workspace of the active project.
 * @param path - Repo-relative path of the edited file.
 * @param projectId - Project identifier for per-project panel state.
 * @param scrollContainerRef - Editor scroll container, focused on Esc.
 * @returns The panel element, or null when the file is outside a manuscript.
 */
function useMetadataPanel(
  workspace: WorkspaceAdapter,
  path: string,
  projectId: string,
  scrollContainerRef: RefObject<HTMLElement | null>,
): ReactNode {
  const root = useMemo(() => manuscriptRootFromPath(path), [path]);
  if (!root) return null;
  return (
    <MetadataPanel
      workspace={workspace}
      manuscriptRoot={root}
      projectKey={projectId}
      editorFocusRef={scrollContainerRef}
    />
  );
}

/** Hook that wires up the Crepe editor, autosave, and mode sync. */
function useManuscriptState(options: UseManuscriptStateOptions) {
  const { workspace, defaultValue, path, mode, onEditorReady, onSaveStatusChange } = options;
  const [sourceMarkdown, setSourceMarkdown] = useState(defaultValue);
  const sourceEditorRef = useRef<SourceEditorHandle | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const prevModeRef = useRef<'wysiwyg' | 'source'>(mode);
  const onStateChangeRef = useRef<(state: CitationState) => void>(() => {});
  const syncContent = useMemo(() => createModeSwitcher(editorRef, sourceEditorRef, prevModeRef, setSourceMarkdown), []);

  // When the path prop changes, write any pending debounced save to the OLD
  // path before the new file's content loads. Declared before useEditor so
  // the flush effect runs ahead of the editor-recreation effects.
  const saver = useDebouncedSaver(workspace, path, onSaveStatusChange);
  // Cmd/Ctrl+S flushes the pending debounced save immediately.
  useSaveShortcut(saver);

  // Reset the mode state machine when the file changes: the recreated editor
  // loads the new content directly, so no content sync between the surfaces
  // runs (and no stale editor is touched). Keyed on the file identity only.
  useEffect(() => {
    prevModeRef.current = mode;
    setSourceMarkdown(defaultValue);
  }, [path, defaultValue]);

  const { loading, get } = useEditor(
    (root) => createCrepeConfig({ root, defaultValue, workspace, onStateChangeRef }),
    [defaultValue, workspace],
  );

  // Source edits schedule the same debounced autosave as visual edits.
  const handleSourceChange = useCallback((md: string) => {
    setSourceMarkdown(md);
    saver.schedule(md);
  }, [saver]);

  useEffect(() => {
    syncContent(mode);
  }, [mode, syncContent]);

  useEditorWiring({ loading, get, workspace, editorRef, saver, syncContent, onEditorReady });

  useInitialCaret(loading, get);

  useFocusScrollGuard(scrollContainerRef);

  return { sourceMarkdown, handleSourceChange, sourceEditorRef, scrollContainerRef };
}

/** Rich visual editor for manuscript block files: Milkdown/Crepe + source companion. */
function RichFileEditor({ workspace, defaultValue, path, mode, onEditorReady, onSaveStatusChange, formattingToolbar, projectId }: FileEditorProps) {
  const { sourceMarkdown, handleSourceChange, sourceEditorRef, scrollContainerRef } = useManuscriptState({
    workspace, defaultValue, path, mode, onEditorReady, onSaveStatusChange,
  });
  const panel = useMetadataPanel(workspace, path, projectId, scrollContainerRef);
  return (
    <EditorFrame editorMode={mode} formattingToolbar={formattingToolbar} path={path} sourceMarkdown={sourceMarkdown} sourceEditorRef={sourceEditorRef}>
      <EditorSurface
        mode={mode}
        sourceMarkdown={sourceMarkdown}
        onSourceChange={handleSourceChange}
        scrollContainerRef={scrollContainerRef}
        sourceEditorRef={sourceEditorRef}
        sourceLanguage="markdown"
        panel={panel}
      />
    </EditorFrame>
  );
}

/**
 * Source-only editor for every non-block file (config, root markdown,
 * bibliography, ...): a CodeMirror surface that never creates a
 * Crepe/Milkdown instance, so non-block files are never rewritten.
 */
function SourceOnlyEditor({ workspace, defaultValue, path, onSaveStatusChange, formattingToolbar, projectId }: FileEditorProps) {
  const [sourceMarkdown, setSourceMarkdown] = useState(defaultValue);
  const sourceEditorRef = useRef<SourceEditorHandle | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const saver = useDebouncedSaver(workspace, path, onSaveStatusChange);
  // Cmd/Ctrl+S flushes the pending debounced save immediately.
  useSaveShortcut(saver);
  const panel = useMetadataPanel(workspace, path, projectId, scrollContainerRef);

  // Reload the buffer when the open file changes.
  useEffect(() => {
    setSourceMarkdown(defaultValue);
  }, [path, defaultValue]);

  // Source edits schedule the same debounced autosave as visual edits.
  const handleSourceChange = useCallback((md: string) => {
    setSourceMarkdown(md);
    saver.schedule(md);
  }, [saver]);

  return (
    <EditorFrame editorMode="source" formattingToolbar={formattingToolbar} path={path} sourceMarkdown={sourceMarkdown} sourceEditorRef={sourceEditorRef}>
      <div className="manuscript-editor" data-testid="manuscript-editor">
        <div ref={scrollContainerRef} tabIndex={-1} style={{ height: '100%', overflow: 'auto' }}>
          {panel}
          <SourceEditor ref={sourceEditorRef} value={sourceMarkdown} onChange={handleSourceChange} className="source-editor" language="plain" />
        </div>
      </div>
    </EditorFrame>
  );
}

/** Manuscript directory of an assembly path: `manuscripts/<id>`. */
function assemblyDir(path: string): string {
  return path.split('/').slice(0, 2).join('/');
}

/** Block short name of `activePath` when it lives under `dir/blocks/`; null otherwise. */
function blockShortFrom(activePath: string, dir: string): string | null {
  const prefix = `${dir}/blocks/`;
  if (!activePath.startsWith(prefix) || !activePath.endsWith('.qmd')) return null;
  const short = activePath.slice(prefix.length, -4);
  return short.length > 0 && !short.includes('/') ? short : null;
}

/**
 * Reveal the active block in the assembly: expand its container and scroll it
 * into view, retrying briefly while the async block list loads.
 */
function useActiveBlockReveal(activeBlockPath: string | undefined, dir: string): void {
  useEffect(() => {
    const short = activeBlockPath === undefined ? null : blockShortFrom(activeBlockPath, dir);
    if (short === null) return undefined;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reveal = (): void => {
      const chip = document.querySelector(`button[aria-label="Copy @sec-${short} reference"]`);
      const section = chip === null ? null : chip.closest('section');
      if (section === null) {
        attempts += 1;
        if (attempts < 40) timer = setTimeout(reveal, 50);
        return;
      }
      const toggle = section.querySelector('button[aria-expanded]');
      if (toggle instanceof HTMLElement && toggle.getAttribute('aria-expanded') === 'false') toggle.click();
      section.scrollIntoView({ block: 'nearest' });
    };
    reveal();
    return () => { if (timer !== undefined) clearTimeout(timer); };
  }, [activeBlockPath, dir]);
}

/** Props for {@link ArticleAssembly}. */
interface ArticleAssemblyProps extends FileEditorProps {
  /** Repo-relative path of the active block file; drives expand-and-scroll. */
  activeBlockPath?: string;
}

/**
 * Assembly surface for `manuscripts/<id>/article.qmd`: the imported block
 * editor plus an action swapping to the source-only editor for the file.
 *
 * @param props - See {@link ArticleAssemblyProps}.
 * @returns The assembly markup, or the source-only editor after the swap.
 */
function ArticleAssembly({ workspace, defaultValue, path, mode, onSaveStatusChange, formattingToolbar, projectId, activeBlockPath }: ArticleAssemblyProps) {
  const [editingSource, setEditingSource] = useState(false);
  const dir = assemblyDir(path);
  useActiveBlockReveal(activeBlockPath, dir);
  if (editingSource) {
    return <SourceOnlyEditor workspace={workspace} defaultValue={defaultValue} path={path} mode={mode} onSaveStatusChange={onSaveStatusChange} formattingToolbar={formattingToolbar} projectId={projectId} />;
  }
  return (
    <div className="manuscript-editor" data-testid="article-assembly">
      <div tabIndex={-1} style={{ height: '100%', overflow: 'auto' }}>
        <button type="button" onClick={() => setEditingSource(true)} className="m-2 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">
          Edit assembly source
        </button>
        <BlockEditor ws={workspace} dir={dir} projectKey={projectId} />
      </div>
    </div>
  );
}

/**
 * Continuous editor over one workspace file, autosaved to the `path` prop.
 * The file-type gate (resolveEditorGate) mounts the Milkdown/Crepe visual
 * editor only for manuscript block files; every other file opens in a
 * source-only surface with no Crepe instance. Pending debounced saves
 * flush to the old path before switching files.
 */
export function ManuscriptEditor({
  workspace,
  defaultValue,
  path,
  onEditorReady,
  mode = 'wysiwyg',
  onSaveStatusChange,
  formattingToolbar = true,
  projectId = 'default',
  activeBlockPath,
}: ManuscriptEditorProps) {
  const { capability, content, editorMode } = resolveEditorGate(path, defaultValue, mode);
  const shared = { workspace, defaultValue: content, path, onSaveStatusChange, formattingToolbar, projectId };
  // The assembly mounts the imported block editor, not the Crepe surfaces.
  if (isManuscriptArticlePath(path)) {
    return <ArticleAssembly {...shared} mode={editorMode} activeBlockPath={activeBlockPath} />;
  }
  if (capability === 'rich') {
    return <RichFileEditor {...shared} mode={editorMode} onEditorReady={onEditorReady} />;
  }
  return <SourceOnlyEditor {...shared} />;
}
