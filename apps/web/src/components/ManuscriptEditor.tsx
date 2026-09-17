import { useCallback, useEffect, useRef, useState } from 'react';
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
import { createCitationPlugin, citationPluginKey, type CitationSelectHandler } from '../citation/plugin';
import { useCitationState } from '../citation/use-citation-state';
import type { CitationState } from '../citation/types';
import { quartoRemarkPlugin, quartoInlineCodePlugin, quartoChunkOptionPlugin } from '../quarto-syntax';
import { EditorSurface } from './EditorSurface';
import type { SourceEditorHandle } from './SourceEditor';

/**
 * CodeMirror theme for code blocks: light yellow active line and selection
 * to match the light Crepe palette.
 */
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
}

interface UseManuscriptStateOptions {
  workspace: WorkspaceAdapter;
  defaultValue: string;
  mode: 'wysiwyg' | 'source';
  onEditorReady?: (api: EditorTestApi) => void;
  onSelectCitekey?: CitationSelectHandler;
}

const SAVE_DEBOUNCE_MS = 800;
interface CrepeConfigOptions {
  root: HTMLElement;
  defaultValue: string;
  placeholderText: string;
  workspace: WorkspaceAdapter;
  onStateChangeRef: React.MutableRefObject<(state: CitationState) => void>;
  onSelectCitekey?: CitationSelectHandler;
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
  };
}

/** Debounced autosave writing the single manuscript markdown file. */
function debouncedSaver(workspace: WorkspaceAdapter) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const save = (markdown: string): void => {
    void saveManuscript(workspace, markdown).catch((error) =>
      console.error('manuscript autosave failed:', error),
    );
  };

  const schedule = (markdown: string): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      save(markdown);
    }, SAVE_DEBOUNCE_MS);
  };

  const flush = (): void => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };

  return { schedule, flush };
}
/** Create the Crepe configuration for the editor. */
function createCrepeConfig(options: CrepeConfigOptions) {
  const { root, defaultValue, placeholderText, workspace, onStateChangeRef, onSelectCitekey } = options;
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
    editor.use($prose(() => createCitationPlugin(workspace, onStateChangeRef.current, onSelectCitekey)));
  });
  return crepe;
}

function useContentSync(
  editorRef: React.MutableRefObject<Editor | null>,
  prevModeRef: React.MutableRefObject<'wysiwyg' | 'source'>,
  sourceMarkdown: string,
  setSourceMarkdown: (md: string) => void,
) {
  return useCallback(
    (newMode: 'wysiwyg' | 'source') => {
      const editor = editorRef.current;
      if (!editor) return;
      if (newMode === 'wysiwyg' && prevModeRef.current === 'source') {
        editor.action(replaceAll(sourceMarkdown));
      } else if (newMode === 'source' && prevModeRef.current === 'wysiwyg') {
        setSourceMarkdown(editor.action(getMarkdown()));
      }
      prevModeRef.current = newMode;
    },
    [sourceMarkdown],
  );
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
      ...ps,
    ]);
  });
  onEditorReady?.(createTestApi(editor, syncContent));
}

/** Hook that wires up the Crepe editor, autosave, and mode sync. */
function useManuscriptState(options: UseManuscriptStateOptions) {
  const { workspace, defaultValue, mode, onEditorReady, onSelectCitekey } = options;
  const placeholderText = PLACEHOLDER_HINT;
  const [sourceMarkdown, setSourceMarkdown] = useState(defaultValue);
  const sourceEditorRef = useRef<SourceEditorHandle | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const prevModeRef = useRef<'wysiwyg' | 'source'>(mode);

  const onStateChangeRef = useRef<(state: CitationState) => void>(() => {});

  const syncContent = useContentSync(editorRef, prevModeRef, sourceMarkdown, setSourceMarkdown);

  const { loading, get } = useEditor(
    (root) => createCrepeConfig({ root, defaultValue, placeholderText, workspace, onStateChangeRef, onSelectCitekey }),
    [defaultValue, workspace, onSelectCitekey],
  );

  const saverRef = useRef<ReturnType<typeof debouncedSaver> | null>(null);
  if (!saverRef.current) saverRef.current = debouncedSaver(workspace);
  const wiredRef = useRef(false);

  // Sync content when mode changes
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

  useEffect(() => {
    const saver = saverRef.current;
    return () => saver?.flush();
  }, []);

  return { sourceMarkdown, setSourceMarkdown, sourceEditorRef, scrollContainerRef, editorRef };
}

function createSelectCitekeyHandler(
  editorRef: React.MutableRefObject<Editor | null>,
  citationDispatchRef: React.MutableRefObject<((action: import('../citation/types').CitationAction) => void) | null>
): CitationSelectHandler {
  return (citekey: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const state = citationPluginKey.getState(
      editor.action((ctx) => ctx.get(editorViewCtx)).state,
    ) as CitationState | null;
    if (!state?.trigger) return;
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { from, bracketed } = state.trigger!;
      const insertText = bracketed ? `[@${citekey}]` : `@${citekey}`;
      const tr = view.state.tr;
      tr.insertText(insertText, from, from + 1);
      view.dispatch(tr);
    });
    citationDispatchRef.current?.({ type: 'CLOSE_CITATION' });
  };
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
}: ManuscriptEditorProps) {
  const editorRef = useRef<Editor | null>(null);
  const citationDispatchRef = useRef<((action: import('../citation/types').CitationAction) => void) | null>(null);

  const handleSelectCitekey = useCallback(
    createSelectCitekeyHandler(editorRef, citationDispatchRef),
    [editorRef, citationDispatchRef],
  );

  const { sourceMarkdown, setSourceMarkdown, sourceEditorRef, scrollContainerRef, editorRef: hookEditorRef } =
    useManuscriptState({ workspace, defaultValue, mode, onEditorReady, onSelectCitekey: handleSelectCitekey });

  // Update editorRef when hookEditorRef.current changes
  useEffect(() => {
    editorRef.current = hookEditorRef.current;
  }, [hookEditorRef.current]);

  // Get citation dispatch from the editor
  const { dispatch: citationDispatch } = useCitationState(editorRef);
  useEffect(() => {
    citationDispatchRef.current = citationDispatch;
  }, [citationDispatch]);

  return (
    <EditorSurface
      mode={mode}
      sourceMarkdown={sourceMarkdown}
      onSourceChange={setSourceMarkdown}
      scrollContainerRef={scrollContainerRef}
      sourceEditorRef={sourceEditorRef}
    />
  );
}