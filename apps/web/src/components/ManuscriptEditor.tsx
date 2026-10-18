import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorView } from '@codemirror/view';
import { Crepe } from '@milkdown/crepe';
import { useEditor } from '@milkdown/react';
import { editorViewCtx, remarkPluginsCtx, type Editor } from '@milkdown/kit/core';
import { listenerCtx } from '@milkdown/kit/plugin/listener';
import { $prose, getMarkdown, replaceAll } from '@milkdown/kit/utils';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { PLACEHOLDER_HINT } from '../placeholder';
import { createCitationPlugin } from '../citation/plugin';
import type { CitationState } from '../citation/types';
import { quartoRemarkPlugin, quartoInlineCodePlugin, quartoChunkOptionPlugin } from '../quarto-syntax';
import { citationRemarkPlugin } from '../citation/citation-remark-plugin';
import { EditorSurface } from './EditorSurface';
import { EditorToolbars } from './EditorToolbars';
import { useEditorCommands } from '../hooks/useEditorCommands';
import { useFocusScrollGuard } from '../hooks/useFocusScrollGuard';
import { useVirtualKeyboard } from '../hooks/useVirtualKeyboard';
import { createModeSwitcher, placeVisualCaret, useInitialCaret } from '../caret-mode-switch';
import { getFileCapability } from '../project/file-capability';
import { useDebouncedSaver, type DebouncedSaver } from './editor/autosave';
import { OpendraftConfigWarning } from './OpendraftConfigWarning';
import type { SourceEditorHandle } from './SourceEditor';
import type { SaveStatus } from './AppHeader';
/** Code blocks: light yellow active line/selection matching the Crepe light palette. */
const lightCodeBlockTheme = EditorView.theme({
  '.cm-activeLine': { backgroundColor: '#fef9c3' },
  '.cm-activeLineGutter': { backgroundColor: '#fef9c3' },
  '.cm-selectionBackground': { backgroundColor: '#fef9c3' },
  '.cm-focused .cm-selectionBackground': { backgroundColor: '#fef9c3' },
});

/** Imperative handle exposed for tests and external tools. */
export interface EditorTestApi {
  /** Insert text at the end of the document through the editor state. */
  insertText(text: string): void;
  /** Current markdown as seen by the editor. */
  getMarkdown(): string;
  /** Replace the entire editor content with new markdown. */
  setMarkdown(markdown: string): void;
  /** Switch between wysiwyg and source mode. */
  setMode(mode: 'wysiwyg' | 'source'): void;
  /** Current visual (ProseMirror) selection position. */
  getCaret(): number;
  /** Place the visual caret; values past the end clamp to the document end. */
  setCaret(pos: number): void;
}

interface ManuscriptEditorProps {
  /** Workspace adapter used for autosave persistence. */
  workspace: WorkspaceAdapter;
  /** Initial markdown content; must be ready before mount. */
  defaultValue: string;
  /** Workspace path this editor autosaves to; pending edits flush to the old path on change. */
  path: string;
  /** Called once the editor instance is ready. */
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

interface CrepeConfigOptions {
  root: HTMLElement;
  defaultValue: string;
  placeholderText: string;
  workspace: WorkspaceAdapter;
  onStateChangeRef: React.MutableRefObject<(state: CitationState) => void>;
}

/** Build the imperative test/external API around a milkdown editor. */
function createTestApi(editor: Editor, syncContent: (mode: 'wysiwyg' | 'source') => void): EditorTestApi {
  return {
    insertText: (text) => {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const position = view.state.doc.content.size;
        view.dispatch(view.state.tr.insertText(text, position));
      });
    },
    getMarkdown: () => editor.action(getMarkdown()),
    setMarkdown: (markdown) => editor.action(replaceAll(markdown)),
    setMode: syncContent,
    getCaret: () => editor.action((ctx) => ctx.get(editorViewCtx).state.selection.from),
    setCaret: (pos) => editor.action((ctx) => placeVisualCaret(ctx.get(editorViewCtx), pos)),
  };
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
      [Crepe.Feature.BlockEdit]: {
        blockHandle: {
          shouldShow: () => false,
        },
      },
    },
  });
  crepe.addFeature((editor) => {
    editor.use($prose(() => createCitationPlugin(workspace, onStateChangeRef.current)));
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
    listener.markdownUpdated((_ctx, markdown) => saver.schedule(markdown));
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

  return { sourceMarkdown, handleSourceChange, sourceEditorRef, scrollContainerRef, editorRef };
}

/**
 * File-type gate: rich files honor the preferred mode, other text files
 * are forced to source mode, and binary content never reaches an editor.
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

/**
 * Continuous editor over one workspace file: one Milkdown/Crepe surface
 * over plain markdown, autosaved to the `path` prop.
 * Pending debounced saves flush to the old path before switching files.
 * Supports toggling between WYSIWYG and raw source editing.
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
  const editorRef = useRef<Editor | null>(null);

  const { capability, content, editorMode } = resolveEditorGate(path, defaultValue, mode);

  const { sourceMarkdown, handleSourceChange, sourceEditorRef, scrollContainerRef, editorRef: hookEditorRef } =
    useManuscriptState({ workspace, defaultValue: content, path, mode: editorMode, onEditorReady, onSaveStatusChange });

  // Update editorRef when hookEditorRef.current changes
  useEffect(() => {
    editorRef.current = hookEditorRef.current;
  }, [hookEditorRef.current]);

  const commands = useEditorCommands(editorMode, () => sourceEditorRef.current?.getView() ?? null);
  const { open: keyboardOpen, bottomOffset } = useVirtualKeyboard();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <EditorToolbars
        commands={commands}
        formattingToolbar={formattingToolbar}
        mode={editorMode}
        open={keyboardOpen}
        bottomOffset={bottomOffset}
      />
      <OpendraftConfigWarning path={path} content={sourceMarkdown} />
      <div style={{ flex: 1, minHeight: 0 }}>
        <EditorSurface
          mode={editorMode}
          sourceMarkdown={sourceMarkdown}
          onSourceChange={handleSourceChange}
          scrollContainerRef={scrollContainerRef}
          sourceEditorRef={sourceEditorRef}
          sourceLanguage={capability === 'rich' ? 'markdown' : 'plain'}
        />
      </div>
    </div>
  );
}