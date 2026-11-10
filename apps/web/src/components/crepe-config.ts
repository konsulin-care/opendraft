import { useEffect, useRef } from 'react';
import { EditorView } from '@codemirror/view';
import { Crepe } from '@milkdown/crepe';
import { editorViewCtx, remarkPluginsCtx, remarkStringifyOptionsCtx, type Editor } from '@milkdown/kit/core';
import { listenerCtx } from '@milkdown/kit/plugin/listener';
import { $prose, getMarkdown } from '@milkdown/kit/utils';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { PLACEHOLDER_HINT } from '../placeholder';
import { createCitationPlugin } from '../citation/plugin';
import type { CitationState } from '../citation/types';
import { quartoRemarkPlugin, quartoInlineCodePlugin, quartoChunkOptionPlugin } from '../quarto-syntax';
import { citationRemarkPlugin } from '../citation/citation-remark-plugin';
import { createTestApi, focusBlockEditor, fulfillPendingFocus, registerBlockEditor, type EditorTestApi } from '../caret-mode-switch';
import type { DebouncedSaver } from './editor/autosave';

/** Code blocks: translucent active line (selection shows through) and a
 *  distinct selection background, via @theme tokens in index.css. */
export const lightCodeBlockTheme = EditorView.theme({
  '.cm-activeLine': { backgroundColor: 'var(--color-active-line)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--color-active-line)' },
  '.cm-selectionBackground': { backgroundColor: 'var(--color-selection)' },
  '.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--color-selection)' },
});

/** Options for {@link createCrepeConfig}. */
interface CrepeConfigOptions {
  root: HTMLElement;
  defaultValue: string;
  workspace: WorkspaceAdapter;
  onStateChangeRef: React.MutableRefObject<(state: CitationState) => void>;
  /** Bib file the citation plugin reads and appends to. */
  bibPath?: string;
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
  const { root, defaultValue, workspace, onStateChangeRef, bibPath } = options;
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
      [Crepe.Feature.BlockEdit]: {
        blockHandle: { shouldShow: () => false },
        // Slash menu (verified against Crepe 7.23.0 types and
        // menu/config.ts, which skips the h1 entry when it is null):
        // block bodies never offer an H1 action. The heading guard
        // registered in BlockBody is the backstop for every other
        // heading-1 path (input rule, command, paste).
        textGroup: { h1: null },
      },
    },
  });
  crepe.addFeature((editor) => {
    editor.use($prose(() => createCitationPlugin(workspace, onStateChangeRef.current, bibPath)));
  });
  crepe.editor.config((ctx) => {
    ctx.update(remarkStringifyOptionsCtx, (options) => ({ ...options, bullet: '-' as const }));
    // Register remark plugins here, at ConfigReady: the editor reduces
    // remarkPluginsCtx into the processor exactly once at SchemaReady,
    // so registering after create() (wireEditor) never reaches the
    // serializer. Each entry must be {plugin, options}.
    ctx.update(remarkPluginsCtx, (ps) => [
      { plugin: citationRemarkPlugin, options: {} },
      quartoRemarkPlugin,
      quartoInlineCodePlugin,
      ...ps,
    ] as unknown as typeof ps);
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
  // Markdown as it stands once the load has settled (load-time
  // normalization, e.g. the heading guard demoting a legacy H1,
  // completes before wiring). An emission equal to this baseline
  // carries no user change, so it must not schedule a save — writing
  // it back would rewrite the just-loaded file.
  const loadedMarkdown = editor.action(getMarkdown());
  editor.action((ctx) => {
    const listener = ctx.get(listenerCtx);
    listener.markdownUpdated((_ctx, markdown) => {
      if (markdown === loadedMarkdown) return;
      saver.schedule(markdown);
    });
  });
  onEditorReady?.(createTestApi(editor, syncContent));
}

/** Options for {@link useEditorWiring}. */
interface EditorWiringOptions {
  loading: boolean;
  /** Short of the block body this wiring belongs to; matches the pending focus request. */
  short: string;
  get: () => Editor | null | undefined;
  workspace: WorkspaceAdapter;
  editorRef: React.MutableRefObject<Editor | null>;
  saver: DebouncedSaver;
  syncContent: (mode: 'wysiwyg' | 'source') => void;
  onEditorReady?: (api: EditorTestApi) => void;
}

/**
 * Register autosave/plugin wiring once per editor instance and enroll the
 * editor in the block-editor registry: toolbar commands and caret/content
 * sync target the most recently focused registered editor. `get` is a new
 * function every render, so it must not be a dependency; the editor-identity
 * ref guard keeps wiring to a single registration per editor instance
 * (Milkdown's markdownUpdated has no unsubscribe handle). `onEditorReady` is
 * also excluded from the deps: it may change identity on a mode-switch
 * rerender, and re-running the effect would unregister the editor mid-commit —
 * before the mode-sync effect reads the registry — silently switching the
 * caret target to another block. Registration only tears down when the editor
 * lifecycle deps change or the component unmounts, so an unmounted block
 * editor is never a command target.
 *
 * @param options - See {@link EditorWiringOptions}.
 */
export function useEditorWiring(options: EditorWiringOptions): void {
  const { loading, short, get, workspace, editorRef, saver, syncContent, onEditorReady } = options;
  const wiredEditorRef = useRef<Editor | null>(null);
  useEffect(() => {
    const editor = get();
    if (!editor) return;
    if (editor !== wiredEditorRef.current) {
      wiredEditorRef.current = editor;
      editorRef.current = editor;
      wireEditor(editor, saver, syncContent, onEditorReady);
    }
    const unregister = registerBlockEditor(editor);
    // A focus request made at block creation is fulfilled here, once
    // the new block's editor finally exists (lazy mount + async create).
    // wireEditor, registerBlockEditor and this call run synchronously in
    // one effect, so waitForApi() implies fulfilment has run.
    fulfillPendingFocus(editor, short);
    const surface = editor.action((ctx) => ctx.get(editorViewCtx));
    const onFocus = () => focusBlockEditor(editor);
    surface.dom.addEventListener('focusin', onFocus);
    return () => {
      surface.dom.removeEventListener('focusin', onFocus);
      unregister();
    };
  }, [loading, workspace, syncContent, saver]);
}
