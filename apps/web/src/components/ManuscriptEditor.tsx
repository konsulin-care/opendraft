import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useEditor } from '@milkdown/react';
import type { Editor } from '@milkdown/kit/core';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import type { CitationState } from '../citation/types';
import { EditorSurface } from './EditorSurface';
import { useFocusScrollGuard } from '../hooks/useFocusScrollGuard';
import { SourceEditor, type SourceEditorHandle } from './SourceEditor';
import { EditorFrame } from './editor-frame';
import { createModeSwitcher, useInitialCaret, type EditorTestApi } from '../caret-mode-switch';
import { resolveEditorGate } from '../project/file-capability';
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
}: ManuscriptEditorProps) {
  const { capability, content, editorMode } = resolveEditorGate(path, defaultValue, mode);
  const shared = { workspace, defaultValue: content, path, onSaveStatusChange, formattingToolbar, projectId };
  if (capability === 'rich') {
    return <RichFileEditor {...shared} mode={editorMode} onEditorReady={onEditorReady} />;
  }
  return <SourceOnlyEditor {...shared} />;
}
