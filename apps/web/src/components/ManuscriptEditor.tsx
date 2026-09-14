import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crepe } from '@milkdown/crepe';
import { Milkdown, useEditor } from '@milkdown/react';
import { editorViewCtx, type Editor } from '@milkdown/kit/core';
import { listenerCtx } from '@milkdown/kit/plugin/listener';
import { getMarkdown, replaceAll } from '@milkdown/kit/utils';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { saveManuscript } from '../persistence';
import { pickPlaceholderHint } from '../placeholder';
import { SourceEditor, type SourceEditorHandle } from './SourceEditor';

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

const SAVE_DEBOUNCE_MS = 800;

/** Build the imperative test/external API around a milkdown editor. */
function createTestApi(
  editor: Editor,
  syncContent: (mode: 'wysiwyg' | 'source') => void,
): EditorTestApi {
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
function createCrepeConfig(root: HTMLElement, defaultValue: string, placeholderText: string) {
  return new Crepe({
    root,
    defaultValue,
    features: {
      [Crepe.Feature.TopBar]: false,
      [Crepe.Feature.AI]: false,
    },
    featureConfigs: {
      [Crepe.Feature.Placeholder]: { text: placeholderText, mode: 'block' },
    },
  });
}

/** Hook that creates the content sync callback for mode switching. */
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

/** Hook that wires up the Crepe editor, autosave, and mode sync. */
function useManuscriptState(
  workspace: WorkspaceAdapter,
  defaultValue: string,
  mode: 'wysiwyg' | 'source',
  onEditorReady?: (api: EditorTestApi) => void,
) {
  const placeholderText = useMemo(pickPlaceholderHint, []);
  const [sourceMarkdown, setSourceMarkdown] = useState(defaultValue);
  const sourceEditorRef = useRef<SourceEditorHandle | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const prevModeRef = useRef<'wysiwyg' | 'source'>(mode);

  const { loading, get } = useEditor(
    (root) => createCrepeConfig(root, defaultValue, placeholderText),
    [defaultValue],
  );

  const saverRef = useRef<ReturnType<typeof debouncedSaver> | null>(null);
  if (!saverRef.current) saverRef.current = debouncedSaver(workspace);
  const wiredRef = useRef(false);

  const syncContent = useContentSync(editorRef, prevModeRef, sourceMarkdown, setSourceMarkdown);

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
    const saver = saverRef.current!;
    editor.action((ctx) => {
      const listener = ctx.get(listenerCtx);
      listener.markdownUpdated((_ctx, markdown) => saver.schedule(markdown));
    });
    onEditorReady?.(createTestApi(editor, syncContent));
  }, [loading, get, onEditorReady, workspace, syncContent]);

  useEffect(() => {
    const saver = saverRef.current;
    return () => saver?.flush();
  }, []);

  return { sourceMarkdown, setSourceMarkdown, sourceEditorRef, scrollContainerRef };
}

interface EditorSurfaceProps {
  mode: 'wysiwyg' | 'source';
  sourceMarkdown: string;
  onSourceChange: (md: string) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  sourceEditorRef: React.RefObject<SourceEditorHandle | null>;
}

/** Renders either the Crepe WYSIWYG surface or the CodeMirror source editor. */
function EditorSurface({
  mode,
  sourceMarkdown,
  onSourceChange,
  scrollContainerRef,
  sourceEditorRef,
}: EditorSurfaceProps) {
  return (
    <div className="manuscript-editor" data-testid="manuscript-editor">
      <div
        ref={scrollContainerRef}
        style={{
          display: mode === 'wysiwyg' ? 'block' : 'none',
          height: '100%',
          overflow: 'auto',
        }}
      >
        <Milkdown />
      </div>
      <div
        style={{
          display: mode === 'source' ? 'block' : 'none',
          height: '100%',
          overflow: 'auto',
        }}
      >
        <SourceEditor
          ref={sourceEditorRef}
          value={sourceMarkdown}
          onChange={onSourceChange}
        />
      </div>
    </div>
  );
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
  const { sourceMarkdown, setSourceMarkdown, sourceEditorRef, scrollContainerRef } =
    useManuscriptState(workspace, defaultValue, mode, onEditorReady);

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
