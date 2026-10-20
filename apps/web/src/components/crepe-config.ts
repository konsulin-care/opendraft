import { useEffect, useRef } from 'react';
import { EditorView } from '@codemirror/view';
import { Crepe } from '@milkdown/crepe';
import { remarkPluginsCtx, remarkStringifyOptionsCtx, type Editor } from '@milkdown/kit/core';
import { listenerCtx } from '@milkdown/kit/plugin/listener';
import { $prose } from '@milkdown/kit/utils';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { PLACEHOLDER_HINT } from '../placeholder';
import { createCitationPlugin } from '../citation/plugin';
import type { CitationState } from '../citation/types';
import { quartoRemarkPlugin, quartoInlineCodePlugin, quartoChunkOptionPlugin } from '../quarto-syntax';
import { citationRemarkPlugin } from '../citation/citation-remark-plugin';
import { createTestApi, type EditorTestApi } from '../caret-mode-switch';
import type { DebouncedSaver } from './editor/autosave';

/** Code blocks: light yellow active line/selection via @theme tokens in index.css. */
export const lightCodeBlockTheme = EditorView.theme({
  '.cm-activeLine': { backgroundColor: 'var(--color-yellow-200)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--color-yellow-200)' },
  '.cm-selectionBackground': { backgroundColor: 'var(--color-yellow-200)' },
  '.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--color-yellow-200)' },
});

/** Options for {@link createCrepeConfig}. */
interface CrepeConfigOptions {
  root: HTMLElement;
  defaultValue: string;
  workspace: WorkspaceAdapter;
  onStateChangeRef: React.MutableRefObject<(state: CitationState) => void>;
}

/**
 * Create the Crepe instance for a manuscript block file: features, the
 * citation plugin, and serializer options (visual edits serialize lists
 * with '-' bullets instead of the remark default '*'; config callbacks
 * run at ConfigReady, before InitReady snapshots remarkStringifyOptionsCtx
 * into the serializer).
 *
 * @param options - See {@link CrepeConfigOptions}.
 * @returns The configured Crepe instance, not yet mounted.
 */
export function createCrepeConfig(options: CrepeConfigOptions): Crepe {
  const { root, defaultValue, workspace, onStateChangeRef } = options;
  const crepe = new Crepe({
    root,
    defaultValue,
    features: {
      [Crepe.Feature.TopBar]: false,
      [Crepe.Feature.AI]: false,
    },
    featureConfigs: {
      [Crepe.Feature.Placeholder]: { text: PLACEHOLDER_HINT, mode: 'block' },
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
  crepe.editor.config((ctx) => {
    ctx.update(remarkStringifyOptionsCtx, (options) => ({ ...options, bullet: '-' }));
  });
  return crepe;
}

/**
 * Wire autosave listener and custom plugins into the Crepe editor. The
 * markdownUpdated listener fires only for user-originated changes, so the
 * initial parse never schedules a save.
 *
 * @param editor - Milkdown editor of a mounted Crepe instance.
 * @param saver - Debounced autosave target.
 * @param syncContent - Syncs pending visual markdown into the source surface.
 * @param onEditorReady - Receives the editor test/inspection API once wired.
 */
export function wireEditor(
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

/** Options for {@link useEditorWiring}. */
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
export function useEditorWiring(options: EditorWiringOptions): void {
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
