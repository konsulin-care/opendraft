import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorView } from '@codemirror/view';
import { Crepe } from '@milkdown/crepe';
import { useEditor } from '@milkdown/react';
import { editorViewCtx, remarkPluginsCtx, type Editor } from '@milkdown/kit/core';
import { listenerCtx } from '@milkdown/kit/plugin/listener';
import { $prose, getMarkdown, replaceAll } from '@milkdown/kit/utils';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { saveManuscript } from '../persistence';
import { PLACEHOLDER_HINT } from '../placeholder';
import { createBlockGutterPlugin } from '../block-handle-gutter';
import { createCitationPlugin } from '../citation/plugin';
import type { CitationState } from '../citation/types';
import { quartoRemarkPlugin, quartoInlineCodePlugin, quartoChunkOptionPlugin } from '../quarto-syntax';
import { citationRemarkPlugin } from '../citation/citation-remark-plugin';
import { EditorSurface } from './EditorSurface';
import { EditorToolbars } from './EditorToolbars';
import { useEditorCommands } from '../hooks/useEditorCommands';
import { useVirtualKeyboard } from '../hooks/useVirtualKeyboard';
import { createModeSwitcher, placeVisualCaret, useInitialCaret } from '../caret-mode-switch';
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
  mode: 'wysiwyg' | 'source';
  onEditorReady?: (api: EditorTestApi) => void;
  onSaveStatusChange?: (status: SaveStatus) => void;
}

const SAVE_DEBOUNCE_MS = 800;
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

/** Debounced autosave writing the single manuscript markdown file. */
function debouncedSaver(workspace: WorkspaceAdapter, onStatus: (status: SaveStatus) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: string | undefined;

  const save = (markdown: string): void => {
    void saveManuscript(workspace, markdown).then(
      () => {
        if (!timer) onStatus('saved');
      },
      (error: unknown) => {
        console.error('manuscript autosave failed:', error);
        onStatus('error');
      },
    );
  };

  const schedule = (markdown: string): void => {
    if (timer) clearTimeout(timer);
    onStatus('saving');
    pending = markdown;
    timer = setTimeout(() => {
      timer = undefined;
      pending = undefined;
      save(markdown);
    }, SAVE_DEBOUNCE_MS);
  };

  /** Save pending content (if any) synchronously, then clear the timer. */
  const flush = (): void => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (pending !== undefined) {
      save(pending);
      pending = undefined;
    }
  };

  return { schedule, flush };
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
    editor.use($prose(() => createBlockGutterPlugin()));
  });
  crepe.addFeature((editor) => {
    editor.use($prose(() => createCitationPlugin(workspace, onStateChangeRef.current)));
  });
  return crepe;
}

/** Wire autosave listener and custom plugins into the Crepe editor. */
function wireEditor(
  editor: Editor,
  saver: ReturnType<typeof debouncedSaver>,
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

/** Hook that wires up the Crepe editor, autosave, and mode sync. */
function useManuscriptState(options: UseManuscriptStateOptions) {
  const { workspace, defaultValue, mode, onEditorReady, onSaveStatusChange } = options;
  const [sourceMarkdown, setSourceMarkdown] = useState(defaultValue);
  const sourceEditorRef = useRef<SourceEditorHandle | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const prevModeRef = useRef<'wysiwyg' | 'source'>(mode);
  const onStateChangeRef = useRef<(state: CitationState) => void>(() => {});
  const syncContent = useMemo(() => createModeSwitcher(editorRef, sourceEditorRef, prevModeRef, setSourceMarkdown), []);

  const { loading, get } = useEditor(
    (root) => createCrepeConfig({ root, defaultValue, placeholderText: PLACEHOLDER_HINT, workspace, onStateChangeRef }),
    [defaultValue, workspace],
  );

  const statusRef = useRef(onSaveStatusChange);
  statusRef.current = onSaveStatusChange;
  const saverRef = useRef<ReturnType<typeof debouncedSaver> | null>(null);
  if (!saverRef.current) saverRef.current = debouncedSaver(workspace, (s) => statusRef.current?.(s));
  const wiredRef = useRef(false);

  // Source edits schedule the same debounced autosave as visual edits.
  const handleSourceChange = useCallback((md: string) => {
    setSourceMarkdown(md);
    saverRef.current?.schedule(md);
  }, []);

  useEffect(() => {
    syncContent(mode);
  }, [mode, syncContent]);

  useEffect(() => {
    if (wiredRef.current) return;
    const editor = get();
    if (!editor) return;
    wiredRef.current = true;
    editorRef.current = editor;
    wireEditor(editor, saverRef.current!, syncContent, onEditorReady);
    return () => {
      wiredRef.current = false;
    };
  }, [loading, get, onEditorReady, workspace, syncContent]);

  useInitialCaret(loading, get);

  useEffect(() => () => saverRef.current?.flush(), []);

  return { sourceMarkdown, handleSourceChange, sourceEditorRef, scrollContainerRef, editorRef };
}

/**
 * Continuous whole-manuscript editor: one Milkdown/Crepe surface over
 * plain markdown, autosaved to a single workspace file.
 * Supports toggling between WYSIWYG and raw source editing.
 */
export function ManuscriptEditor({
  workspace,
  defaultValue,
  onEditorReady,
  mode = 'wysiwyg',
  onSaveStatusChange,
  formattingToolbar = true,
}: ManuscriptEditorProps) {
  const editorRef = useRef<Editor | null>(null);

  const { sourceMarkdown, handleSourceChange, sourceEditorRef, scrollContainerRef, editorRef: hookEditorRef } =
    useManuscriptState({ workspace, defaultValue, mode, onEditorReady, onSaveStatusChange });

  // Update editorRef when hookEditorRef.current changes
  useEffect(() => {
    editorRef.current = hookEditorRef.current;
  }, [hookEditorRef.current]);

  const commands = useEditorCommands(mode, () => sourceEditorRef.current?.getView() ?? null);
  const { open: keyboardOpen, bottomOffset } = useVirtualKeyboard();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <EditorToolbars
        commands={commands}
        formattingToolbar={formattingToolbar}
        mode={mode}
        open={keyboardOpen}
        bottomOffset={bottomOffset}
      />
      <div style={{ flex: 1, minHeight: 0 }}>
        <EditorSurface
          mode={mode}
          sourceMarkdown={sourceMarkdown}
          onSourceChange={handleSourceChange}
          scrollContainerRef={scrollContainerRef}
          sourceEditorRef={sourceEditorRef}
        />
      </div>
    </div>
  );
}