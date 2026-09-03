import { useEffect, useRef } from 'react';
import { Crepe } from '@milkdown/crepe';
import { editorViewCtx } from '@milkdown/kit/core';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { applyDraftFlags, createManuscriptDoc, wholeDocMarkdown, type Node } from '@opendraft/editor';
import { loadManuscript, saveManuscript } from '../persistence';

import '@milkdown/crepe/theme/classic.css';
import '@milkdown/crepe/theme/common/prosemirror.css';
import '@milkdown/crepe/theme/common/reset.css';

/** Imperative handle exposed for tests and external tools. */
export interface EditorTestApi {
  /** Insert text at the end of the document through the editor state. */
  insertText(text: string): void;
  /** Current markdown as seen by the editor. */
  getMarkdown(): string;
}

interface ManuscriptEditorProps {
  workspace: WorkspaceAdapter;
  onEditorReady?: (api: EditorTestApi) => void;
}

const SAVE_DEBOUNCE_MS = 800;

/** Disable DOM-layout-heavy crepe features under vitest (jsdom). */
function isTestEnv(): boolean {
  return (
    typeof import.meta !== 'undefined' &&
    (import.meta as { env?: Record<string, string | undefined> }).env?.MODE === 'test'
  );
}

/** Slugs of sections flagged draft in the manuscript doc. */
function collectDraftSlugs(doc: Node): Set<string> {
  const slugs = new Set<string>();
  for (let i = 0; i < doc.childCount; i += 1) {
    const child = doc.child(i);
    if (child.type.name === 'section' && child.attrs.draft) {
      slugs.add(String(child.attrs.id));
    }
  }
  return slugs;
}

/** Debounced autosave writing block files + assembly for a workspace. */
function debouncedSaver(workspace: WorkspaceAdapter) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const save = (markdown: string, draftSlugs: ReadonlySet<string>): void => {
    void (async () => {
      const doc = createManuscriptDoc(markdown);
      await saveManuscript(workspace, applyDraftFlags(doc, draftSlugs));
    })().catch((error) => console.error('manuscript autosave failed:', error));
  };

  const schedule = (markdown: string, draftSlugs: ReadonlySet<string>): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => save(markdown, draftSlugs), SAVE_DEBOUNCE_MS);
  };

  const flush = (): void => {
    if (timer) clearTimeout(timer);
  };

  return { schedule, flush };
}

/** Build the imperative test/external API around a crepe instance. */
function createTestApi(editor: Crepe): EditorTestApi {
  return {
    insertText: (text) => {
      editor.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const position = view.state.doc.content.size;
        view.dispatch(view.state.tr.insertText(text, position));
      });
    },
    getMarkdown: () => editor.getMarkdown(),
  };
}

/** Mount crepe over the manuscript markdown and wire the autosave loop. */
function mountEditor(
  root: HTMLElement,
  workspace: WorkspaceAdapter,
  onEditorReady?: (api: EditorTestApi) => void,
): () => void {
  let disposed = false;
  let crepe: Crepe | null = null;
  const saver = debouncedSaver(workspace);

  void (async () => {
    try {
      const { doc, warnings } = await loadManuscript(workspace);
      if (disposed) return;
      if (warnings.length > 0) console.warn('manuscript includes:', warnings);
      const draftSlugs = collectDraftSlugs(doc);

      const editor = new Crepe({
        root,
        defaultValue: wholeDocMarkdown(doc),
        features: {
          [Crepe.Feature.AI]: false,
          [Crepe.Feature.TopBar]: !isTestEnv(),
          [Crepe.Feature.BlockEdit]: !isTestEnv(),
          [Crepe.Feature.CodeMirror]: !isTestEnv(),
          [Crepe.Feature.Latex]: !isTestEnv(),
          [Crepe.Feature.Toolbar]: !isTestEnv(),
        },
      });

      editor.on((listener) => {
        listener.markdownUpdated((_ctx, markdown) => saver.schedule(markdown, draftSlugs));
      });

      await editor.create();
      if (disposed) return;
      crepe = editor;
      onEditorReady?.(createTestApi(editor));
    } catch (error) {
      console.error('manuscript editor mount failed:', error);
    }
  })();

  return () => {
    disposed = true;
    saver.flush();
    void crepe?.destroy();
  };
}

/**
 * Continuous whole-manuscript editor backed by Milkdown/Crepe.
 *
 * @param props - Workspace adapter and optional test-ready callback.
 */
export function ManuscriptEditor({ workspace, onEditorReady }: ManuscriptEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    return root ? mountEditor(root, workspace, onEditorReady) : undefined;
  }, [workspace, onEditorReady]);

  return (
    <div data-testid="manuscript-editor">
      <div ref={rootRef} className="manuscript-editor" />
    </div>
  );
}