/**
 * Block body: lazily mounts one Milkdown (Crepe) editor per block,
 * loads it through `splitHeading`, autosaves edits reattached to the
 * canonical heading, and demotes every body heading-1 to an H2.
 */
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Editor } from '@milkdown/kit/core';
import { $prose } from '@milkdown/kit/utils';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { blockFileName } from '@opendraft/schema';
import type { SaveStatus } from '../components/AppHeader';
import type { EditorTestApi } from '../caret-mode-switch';
import type { CitationState } from '../citation/types';
import { createCrepeConfig, useEditorWiring } from '../components/crepe-config';
import type { DebouncedSaver } from '../components/editor/autosave';
import { createHeadingGuard } from './heading-guard';
import { reportLoadedBody } from './BlockHeader';
import type { BlockHeading } from './heading';
import { captureLoadedHeading } from './heading-capture';
import { useBlockFileText } from './use-block-file-text';
import { useLazyMount } from './use-lazy-mount';
import { countWords, useBodySaver, useLatestRef, useReadOnly } from './read-only-context';
import type { WordCountSink } from './read-only-context';
import { sharedBibPath } from '../citation/references-source';
import type { CrossrefIndexHandle } from '../crossref/use-crossref-index';

/** Section type given to blocks that carry no type of their own. */
const GENERIC_TYPE = 'section';

/** Stable no-op surface-sync callback (mode switching was removed). */
const NOOP_SYNC = () => undefined;

/** Registered autosave flush hooks of mounted bodies, keyed by block short. */
const bodyFlushers = new Map<string, () => void>();

/**
 * Flush a mounted block body's pending autosave immediately.
 *
 * Called before a committed retitle so a pending body edit lands on the
 * current file before the rename path moves it; no-ops while the body
 * is not mounted (no editor, no pending save).
 *
 * @param short - Short name of the block whose autosave should flush.
 */
export function flushBlockBody(short: string): void {
  bodyFlushers.get(short)?.();
}

/** Props for {@link BlockBody}. */
export interface BlockBodyProps {
  /** Workspace holding the manuscript files. */
  ws: WorkspaceAdapter;
  /** Manuscript directory, e.g. `manuscripts/demo`. */
  dir: string;
  /** Block short name — the file name without `.qmd`. */
  short: string;
  /** Block file name inside `blocks/`; defaults to `blockFileName(short)`. */
  file?: string;
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
  /** In-memory cross-reference index shared with the citation plugin. */
  crossrefs?: CrossrefIndexHandle;
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
  /** Cross-reference index read by the citation plugin. */
  crossrefsRef: RefObject<CrossrefIndexHandle | undefined>;
  /** Renders the editor without editing (reader view). */
  readOnly: boolean;
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
  const { mounted, fileText, ws, short, title, bibPath, readOnly } = options;
  const { rootRef, editorRef, headingRef, citationStateRef, onWordCountRef, crossrefsRef } = options;
  const [ready, setReady] = useState(false);
  // Title is only a fallback for heading-less files; a retitle must not recreate the editor from stale text.
  const titleRef = useRef(title);
  titleRef.current = title;
  useEffect(() => {
    if (!mounted || fileText === null || rootRef.current === null) return undefined;
    const { heading, body } = captureLoadedHeading(fileText, titleRef.current, short, GENERIC_TYPE);
    headingRef.current = heading;
    onWordCountRef.current?.(countWords(body));
    // Surface an H1 already present in the loaded body as a header
    // warning badge; reporting never writes the file back.
    reportLoadedBody(short, body);
    const crepe = createCrepeConfig({
      root: rootRef.current,
      defaultValue: body,
      workspace: ws,
      onStateChangeRef: citationStateRef,
      bibPath,
      getCrossrefs: () => crossrefsRef.current?.getCrossrefs() ?? [],
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
      if (readOnly) crepe.setReadonly(true);
      editorRef.current = crepe.editor;
      setReady(true);
    });
    return () => {
      cancelled = true;
      editorRef.current = null;
      setReady(false);
      crepe.destroy();
    };
  }, [mounted, fileText, ws, short, bibPath, readOnly]);
  return ready;
}

/**
 * Expose the flush hook so a title commit can drain pending saves
 * before the retitle renames the file out from under them.
 */
function useBodyFlush(short: string, joinedSaver: DebouncedSaver): void {
  useEffect(() => {
    bodyFlushers.set(short, joinedSaver.flush);
    return () => {
      bodyFlushers.delete(short);
    };
  }, [short, joinedSaver]);
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
export function BlockBody({ ws, dir, short, file, title, collapsed, onWordCount, onSaveStatus, onEditorReady, crossrefs }: BlockBodyProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const mounted = useLazyMount(hostRef, !collapsed);
  const fileName = file ?? blockFileName(short);
  const path = `${dir}/blocks/${fileName}`;

  // Callbacks live in refs so their identity never retriggers effects.
  const onWordCountRef = useLatestRef(onWordCount);
  const onEditorReadyRef = useLatestRef(onEditorReady);
  const crossrefsRef = useLatestRef(crossrefs);

  // Heading captured at load; every save reattaches it verbatim.
  const headingRef = useRef<BlockHeading>({ title, anchor: `sec-${short}`, type: GENERIC_TYPE });
  const citationStateRef = useRef<(state: CitationState) => void>(() => undefined);

  const readOnly = useReadOnly();
  const fileText = useBlockFileText(ws, path, mounted);
  const ready = useCrepeEditor({
    mounted, fileText, ws, short, title, rootRef, bibPath: sharedBibPath(dir),
    editorRef, headingRef, citationStateRef, onWordCountRef, crossrefsRef, readOnly,
  });
  const joinedSaver = useBodySaver({
    ws, path, file: fileName, readOnly, headingRef, onWordCountRef, crossrefsRef, onSaveStatus,
  });
  useBodyFlush(short, joinedSaver);

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
