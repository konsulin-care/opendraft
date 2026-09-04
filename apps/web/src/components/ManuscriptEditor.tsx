import { useEffect, useMemo, useRef } from 'react';
import { Crepe } from '@milkdown/crepe';
import { Milkdown, useEditor } from '@milkdown/react';
import { editorViewCtx, type Editor } from '@milkdown/kit/core';
import { listenerCtx } from '@milkdown/kit/plugin/listener';
import { getMarkdown } from '@milkdown/kit/utils';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { saveManuscript } from '../persistence';
import { pickPlaceholderHint } from '../placeholder';

import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/classic.css';

/** Imperative handle exposed for tests and external tools. */
export interface EditorTestApi {
  /** Insert text at the end of the document through the editor state. */
  insertText(text: string): void;
  /** Current markdown as seen by the editor. */
  getMarkdown(): string;
}

interface ManuscriptEditorProps {
  /** Workspace adapter used for autosave persistence. */
  workspace: WorkspaceAdapter;
  /** Initial markdown content; must be ready before mount. */
  defaultValue: string;
  /** Called once the editor instance is ready. */
  onEditorReady?: (api: EditorTestApi) => void;
}

const SAVE_DEBOUNCE_MS = 800;

/** Build the imperative test/external API around a milkdown editor. */
function createTestApi(editor: Editor): EditorTestApi {
  return {
    insertText: (text) => {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const position = view.state.doc.content.size;
        view.dispatch(view.state.tr.insertText(text, position));
      });
    },
    getMarkdown: () => editor.action(getMarkdown()),
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

/**
 * Continuous whole-manuscript editor: one Milkdown/Crepe surface over
 * plain markdown, autosaved to a single workspace file.
 *
 * @param props - Workspace adapter, initial markdown, optional ready callback.
 */
export function ManuscriptEditor({ workspace, defaultValue, onEditorReady }: ManuscriptEditorProps) {
  const placeholderText = useMemo(pickPlaceholderHint, []);
  const { loading, get } = useEditor(
    (root) =>
      new Crepe({
        root,
        defaultValue,
        features: {
          [Crepe.Feature.TopBar]: false,
          [Crepe.Feature.AI]: false,
        },
        featureConfigs: {
          [Crepe.Feature.Placeholder]: { text: placeholderText, mode: 'block' },
        },
      }),
    [defaultValue],
  );

  const saverRef = useRef<ReturnType<typeof debouncedSaver> | null>(null);
  if (!saverRef.current) saverRef.current = debouncedSaver(workspace);
  const wiredRef = useRef(false);

  useEffect(() => {
    if (wiredRef.current) return;
    const editor = get();
    if (!editor) return;
    wiredRef.current = true;

    const saver = saverRef.current!;
    editor.action((ctx) => {
      const listener = ctx.get(listenerCtx);
      listener.markdownUpdated((_ctx, markdown) => saver.schedule(markdown));
    });
    onEditorReady?.(createTestApi(editor));
  }, [loading, get, onEditorReady, workspace]);

  useEffect(() => {
    const saver = saverRef.current;
    return () => saver?.flush();
  }, []);

  return (
    <div className="manuscript-editor" data-testid="manuscript-editor">
      <Milkdown />
    </div>
  );
}