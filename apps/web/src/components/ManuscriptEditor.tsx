import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorView } from '@codemirror/view';
import { Crepe } from '@milkdown/crepe';
import { useEditor } from '@milkdown/react';
import { remarkPluginsCtx, remarkStringifyOptionsCtx, type Editor } from '@milkdown/kit/core';
import { listenerCtx } from '@milkdown/kit/plugin/listener';
import { $prose } from '@milkdown/kit/utils';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { PLACEHOLDER_HINT } from '../placeholder';
import { createCitationPlugin } from '../citation/plugin';
import type { CitationState } from '../citation/types';
import { quartoRemarkPlugin, quartoInlineCodePlugin, quartoChunkOptionPlugin } from '../quarto-syntax';
import { citationRemarkPlugin } from '../citation/citation-remark-plugin';
import { EditorSurface } from './EditorSurface';
import { useFocusScrollGuard } from '../hooks/useFocusScrollGuard';
import { SourceEditor, type SourceEditorHandle } from './SourceEditor';
import { EditorFrame } from './editor-frame';
import {
  createModeSwitcher,
  createTestApi,
  useInitialCaret,
  type EditorTestApi,
} from '../caret-mode-switch';
import { getFileCapability } from '../project/file-capability';
import { useDebouncedSaver, type DebouncedSaver } from './editor/autosave';
import type { SaveStatus } from './AppHeader';

export type { EditorTestApi } from '../caret-mode-switch';

/** Code blocks: light yellow active line/selection via @theme tokens in index.css. */
const lightCodeBlockTheme = EditorView.theme({
  '.cm-activeLine': { backgroundColor: 'var(--color-yellow-200)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--color-yellow-200)' },
  '.cm-selectionBackground': { backgroundColor: 'var(--color-yellow-200)' },
  '.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--color-yellow-200)' },
});

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
}

interface CrepeConfigOptions {
  root: HTMLElement;
  defaultValue: string;
  placeholderText: string;
  workspace: WorkspaceAdapter;
  onStateChangeRef: React.MutableRefObject<(state: CitationState) => void>;
}

/** Create the Crepe configuration for the editor. */
function createCrepeConfig(options: CrepeConfigOptions) {
  const { root, defaultValue, placeholderText, workspace, onStateChangeRef } = options;
  const crepe = new Crepe({
    root,
    defaultValue,
    features: {
      [Crepe.Feature.TopBar]: false,
      [Crepe.Feature.AI]: false,
    },
    featureConfigs: {
      [Crepe.Feature.Placeholder]: { text: placeholderText, mode: 'block' },
      [Crepe.Feature.Cursor]: { virtual: false },
      [Crepe.Feature.CodeMirror]: {
        theme: lightCodeBlockTheme,
        extensions: [quartoChunkOptionPlugin],
      },
      [Crepe.Feature.BlockEdit]: { blockHandle: { shouldShow: () => false } },
    },
  });
  crepe.addFeature((editor) => {
    editor.use($prose(() => createCitationPlugin(workspace, onStateChangeRef.current)));
  });
  // Visual edits serialize lists with '-' bullets instead of the remark
  // default '*'. Config callbacks run at ConfigReady, before InitReady
  // snapshots remarkStringifyOptionsCtx into the serializer.
  crepe.editor.config((ctx) => {
    ctx.update(remarkStringifyOptionsCtx, (options) => ({ ...options, bullet: '-' }));
  });
  return crepe;
}

/** Wire autosave listener and custom plugins into the Crepe editor. */
function wireEditor(
  editor: Editor,
  saver: DebouncedSaver,
  syncContent: (mode: 'wysiwyg' | 'source') => void,
  onEditorReady?: (api: EditorTestApi) => void,
): void {
  editor.action((ctx) => {
    const listener = ctx.get(listenerCtx);
    listener.markdownUpdated((_ctx, markdown) => {
      saver.schedule(markdown);
    });
  });
  editor.action((ctx) => {
    ctx.update(remarkPluginsCtx, (ps) => [
      quartoRemarkPlugin,
      quartoInlineCodePlugin,
      citationRemarkPlugin,
      ...ps,
    ]);
  });
  onEditorReady?.(createTestApi(editor, syncContent));
}

interface EditorWiringOptions {
  loading: boolean;
  get: () => Editor | null | undefined;
  workspace: WorkspaceAdapter;
  editorRef: React.MutableRefObject<Editor | null>;
  saver: DebouncedSaver;
  syncContent: (mode: 'wysiwyg' | 'source') => void;
  onEditorReady?: (api: EditorTestApi) => void;
}

/**
 * Register autosave/plugin wiring once per editor instance. `get` is a new
 * function every render, so it must not be a dependency; the editor-identity
 * ref guard keeps wiring to a single registration per editor instance
 * (Milkdown's markdownUpdated has no unsubscribe handle).
 *
 * @param options - See {@link EditorWiringOptions}.
 */
function useEditorWiring(options: EditorWiringOptions): void {
  const { loading, get, workspace, editorRef, saver, syncContent, onEditorReady } = options;
  const wiredEditorRef = useRef<Editor | null>(null);
  useEffect(() => {
    const editor = get();
    if (!editor || editor === wiredEditorRef.current) return;
    wiredEditorRef.current = editor;
    editorRef.current = editor;
    wireEditor(editor, saver, syncContent, onEditorReady);
  }, [loading, onEditorReady, workspace, syncContent, saver]);
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
    (root) => createCrepeConfig({ root, defaultValue, placeholderText: PLACEHOLDER_HINT, workspace, onStateChangeRef }),
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

/**
 * File-type gate: manuscript block files honor the preferred mode, other
 * text files are forced to source mode, and binary content never reaches
 * an editor.
 *
 * @param path - Workspace path of the file being edited.
 * @param defaultValue - Current file content.
 * @param mode - User-preferred editing mode.
 * @returns The file capability, editor-safe content, and effective mode.
 */
function resolveEditorGate(path: string, defaultValue: string, mode: 'wysiwyg' | 'source') {
  const capability = getFileCapability(path, defaultValue);
  const content = capability === 'binary' ? '' : defaultValue;
  return { capability, content, editorMode: capability === 'rich' ? mode : 'source' };
}

/** Rich visual editor for manuscript block files: Milkdown/Crepe + source companion. */
function RichFileEditor({ workspace, defaultValue, path, mode, onEditorReady, onSaveStatusChange, formattingToolbar }: FileEditorProps) {
  const { sourceMarkdown, handleSourceChange, sourceEditorRef, scrollContainerRef } = useManuscriptState({
    workspace, defaultValue, path, mode, onEditorReady, onSaveStatusChange,
  });
  return (
    <EditorFrame editorMode={mode} formattingToolbar={formattingToolbar} path={path} sourceMarkdown={sourceMarkdown} sourceEditorRef={sourceEditorRef}>
      <EditorSurface
        mode={mode}
        sourceMarkdown={sourceMarkdown}
        onSourceChange={handleSourceChange}
        scrollContainerRef={scrollContainerRef}
        sourceEditorRef={sourceEditorRef}
        sourceLanguage="markdown"
      />
    </EditorFrame>
  );
}

/**
 * Source-only editor for every non-block file (config, root markdown,
 * bibliography, ...): a CodeMirror surface that never creates a
 * Crepe/Milkdown instance, so non-block files are never rewritten.
 */
function SourceOnlyEditor({ workspace, defaultValue, path, onSaveStatusChange, formattingToolbar }: FileEditorProps) {
  const [sourceMarkdown, setSourceMarkdown] = useState(defaultValue);
  const sourceEditorRef = useRef<SourceEditorHandle | null>(null);
  const saver = useDebouncedSaver(workspace, path, onSaveStatusChange);

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
        <div style={{ height: '100%', overflow: 'auto' }}>
          <SourceEditor ref={sourceEditorRef} value={sourceMarkdown} onChange={handleSourceChange} className="source-editor" language="plain" />
        </div>
      </div>
    </EditorFrame>
  );
}

/**
 * Continuous editor over one workspace file, autosaved to the `path` prop.
 * Manuscript block files mount the Milkdown/Crepe visual editor; every
 * other file opens in a source-only surface with no Crepe instance.
 * Pending debounced saves flush to the old path before switching files.
 */
export function ManuscriptEditor({
  workspace,
  defaultValue,
  path,
  onEditorReady,
  mode = 'wysiwyg',
  onSaveStatusChange,
  formattingToolbar = true,
}: ManuscriptEditorProps) {
  const { capability, content, editorMode } = resolveEditorGate(path, defaultValue, mode);
  const shared = { workspace, defaultValue: content, path, onSaveStatusChange, formattingToolbar };
  if (capability === 'rich') {
    return <RichFileEditor {...shared} mode={editorMode} onEditorReady={onEditorReady} />;
  }
  return <SourceOnlyEditor {...shared} />;
}
