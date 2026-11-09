/**
 * Block body: lazily mounts one Milkdown (Crepe) editor per block. The
 * editor mounts only after the block is expanded and has intersected
 * the viewport (via `useLazyMount`), loads its body through
 * `splitHeading` and persists edits through `joinHeading` + the shared
 * debounced saver. The load never schedules a save; every save
 * reattaches the canonical heading so the block file's first line
 * survives editing, and a heading guard registered on the instance
 * demotes every heading-1 in the body to an H2.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Editor } from '@milkdown/kit/core';
import { $prose } from '@milkdown/kit/utils';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import type { SaveStatus } from '../components/AppHeader';
import type { EditorTestApi } from '../caret-mode-switch';
import type { CitationState } from '../citation/types';
import { createCrepeConfig, useEditorWiring } from '../components/crepe-config';
import { useDebouncedSaver } from '../components/editor/autosave';
import type { DebouncedSaver } from '../components/editor/autosave';
import { createHeadingGuard } from './heading-guard';
import { reportLoadedBody } from './BlockHeader';
import { joinHeading, splitHeading } from './heading';
import type { BlockHeading } from './heading';
import { useLazyMount } from './use-lazy-mount';
import { sharedBibPath } from '../citation/references-source';

/** Section type given to blocks that carry no type of their own. */
const GENERIC_TYPE = 'section';

/** Stable no-op surface-sync callback (mode switching was removed). */
const NOOP_SYNC = () => undefined;

/** Word-count sink carried in the props; absent means no reporter. */
type WordCountSink = ((count: number) => void) | undefined;

/**
 * Count whitespace-separated words in a markdown body.
 *
 * @param text - Markdown text, typically the block body.
 * @returns The number of words; 0 for blank text.
 */
function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/** Props for {@link BlockBody}. */
export interface BlockBodyProps {
  /** Workspace holding the manuscript files. */
  ws: WorkspaceAdapter;
  /** Manuscript directory, e.g. `manuscripts/demo`. */
  dir: string;
  /** Block short name — the file name without `.qmd`. */
  short: string;
  /** Section title used when the block file has no heading of its own. */
  title: string;
  /** Collapsed blocks never earn an editor mount. */
  collapsed: boolean;
  /** Reports the body word count so the header can display it. */
  onWordCount?: (count: number) => void;
  /** Reports autosave progress so the header can display it. */
  onSaveStatus?: (status: SaveStatus) => void;
  /** Receives the editor test API once the editor is wired (tests/tools). */
  onEditorReady?: (api: EditorTestApi) => void;
}

/**
 * Load the block file text once the block has earned mounting.
 *
 * Reads at most once: while a load is pending or done the effect
 * no-ops, and the cleanup marks an in-flight read stale so a torn-down
 * body never applies an outdated result.
 *
 * @param ws - Workspace holding the manuscript.
 * @param path - Path of the block file, e.g. `.../blocks/short.qmd`.
 * @param mounted - Whether the editor has earned mounting.
 * @returns The file text, or `null` while the first load is pending.
 */
function useBlockFileText(
  ws: WorkspaceAdapter,
  path: string,
  mounted: boolean,
): string | null {
  const [fileText, setFileText] = useState<string | null>(null);
  useEffect(() => {
    if (!mounted || fileText !== null) return undefined;
    let stale = false;
    void ws.readFile(path).then((text) => {
      if (!stale) setFileText(text ?? '');
    });
    return () => {
      stale = true;
    };
  }, [mounted, fileText, ws, path]);
  return fileText;
}

/** Options for {@link useCrepeEditor}. */
interface CrepeEditorOptions {
  /** Whether the block has earned mounting. */
  mounted: boolean;
  /** Loaded block file text; `null` while the load is pending. */
  fileText: string | null;
  /** Workspace holding the block file. */
  ws: WorkspaceAdapter;
  /** Shared bib path handed to the citation plugin. */
  bibPath: string;
  /** Short name used as the fallback anchor. */
  short: string;
  /** Title used as the fallback heading title. */
  title: string;
  /** Root element the Crepe instance mounts into. */
  rootRef: RefObject<HTMLDivElement | null>;
  /** Receives the created editor; cleared when the editor tears down. */
  editorRef: RefObject<Editor | null>;
  /** Heading rewritten from the loaded file, reused by every save. */
  headingRef: RefObject<BlockHeading>;
  /** Citation state sink handed to the Crepe configuration. */
  citationStateRef: RefObject<(state: CitationState) => void>;
  /** Receives the loaded body's word count. */
  onWordCountRef: RefObject<WordCountSink>;
}

/**
 * Create the Crepe editor from the loaded block file once the block
 * has earned mounting.
 *
 * The load's canonical heading is captured into `headingRef` before the
 * editor is created (every save reattaches it verbatim), the loaded
 * body's word count is reported once, and the instance is destroyed on
 * teardown so a recreated block never leaks an editor.
 *
 * @param options - See {@link CrepeEditorOptions}.
 * @returns Whether the editor finished creating.
 */
function useCrepeEditor(options: CrepeEditorOptions): boolean {
  const { mounted, fileText, ws, short, title, bibPath } = options;
  const { rootRef, editorRef, headingRef, citationStateRef, onWordCountRef } = options;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!mounted || fileText === null || rootRef.current === null) return undefined;
    const parts = splitHeading(fileText);
    headingRef.current = {
      title: parts.title ?? title,
      anchor: parts.anchor ?? `sec-${short}`,
      type: parts.type ?? GENERIC_TYPE,
    };
    onWordCountRef.current?.(countWords(parts.body));
    // Surface an H1 already present in the loaded body as a header
    // warning badge; reporting never writes the file back.
    reportLoadedBody(short, parts.body);
    const crepe = createCrepeConfig({
      root: rootRef.current,
      defaultValue: parts.body,
      workspace: ws,
      onStateChangeRef: citationStateRef,
      bibPath,
    });
    // Every block editor demotes H1s: register the heading guard on
    // the block-body Crepe instance before it mounts. The slash menu
    // drops its H1 entry in crepe-config's textGroup hook; this guard
    // is the backstop for input-rule, command and paste paths.
    crepe.addFeature((editor) => {
      editor.use($prose(() => createHeadingGuard()));
    });
    let cancelled = false;
    void crepe.create().then(() => {
      if (cancelled) {
        crepe.destroy();
        return;
      }
      editorRef.current = crepe.editor;
      setReady(true);
    });
    return () => {
      cancelled = true;
      editorRef.current = null;
      setReady(false);
      crepe.destroy();
    };
  }, [mounted, fileText, ws, short, title, bibPath]);
  return ready;
}

/**
 * Wrap the shared debounced saver so scheduled markdown is rejoined
 * onto the block's canonical heading and its words are reported
 * upward before the save is queued.
 *
 * @param saver - Debounced autosave target for the block file.
 * @param headingRef - Heading captured at load; reattached verbatim.
 * @param onWordCountRef - Receives the edited body's word count.
 * @returns A saver handle whose identity is stable across renders.
 */
function useJoinedSaver(
  saver: DebouncedSaver,
  headingRef: RefObject<BlockHeading>,
  onWordCountRef: RefObject<WordCountSink>,
): DebouncedSaver {
  return useMemo(
    () => ({
      setPath: (path: string) => saver.setPath(path),
      schedule: (markdown: string) => {
        onWordCountRef.current?.(countWords(markdown));
        saver.schedule(joinHeading(headingRef.current, markdown));
      },
      flush: () => saver.flush(),
    }),
    [saver],
  );
}

/**
 * One lazily mounted visual editor for a block body: loads the block
 * file (split at its canonical heading), mounts Crepe once the block
 * has earned mounting, autosaves user edits joined back onto the
 * canonical heading, and reports word count and save status upward.
 *
 * @param props - See {@link BlockBodyProps}.
 * @returns The mount host; the editor root appears once mounted.
 */
export function BlockBody({ ws, dir, short, title, collapsed, onWordCount, onSaveStatus, onEditorReady }: BlockBodyProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const mounted = useLazyMount(hostRef, !collapsed);
  const path = `${dir}/blocks/${short}.qmd`;

  // Callbacks live in refs so their identity never retriggers effects.
  const onWordCountRef = useRef(onWordCount);
  onWordCountRef.current = onWordCount;
  const onEditorReadyRef = useRef(onEditorReady);
  onEditorReadyRef.current = onEditorReady;

  // Heading captured at load; every save reattaches it verbatim.
  const headingRef = useRef<BlockHeading>({ title, anchor: `sec-${short}`, type: GENERIC_TYPE });
  const citationStateRef = useRef<(state: CitationState) => void>(() => undefined);

  const saver = useDebouncedSaver(ws, path, onSaveStatus);
  const fileText = useBlockFileText(ws, path, mounted);
  const ready = useCrepeEditor({
    mounted, fileText, ws, short, title, rootRef, bibPath: sharedBibPath(dir),
    editorRef, headingRef, citationStateRef, onWordCountRef,
  });
  const joinedSaver = useJoinedSaver(saver, headingRef, onWordCountRef);

  // Register autosave + the block-editor registry so toolbar commands
  // reach this body's editor.
  useEditorWiring({
    loading: !ready,
    short,
    get: () => editorRef.current,
    workspace: ws,
    editorRef,
    saver: joinedSaver,
    syncContent: NOOP_SYNC,
    onEditorReady: (api) => onEditorReadyRef.current?.(api),
  });

  return (
    <div ref={hostRef} data-testid="block-body-host">
      {mounted && fileText !== null && (
        <div ref={rootRef} data-testid="block-body-editor" />
      )}
    </div>
  );
}
