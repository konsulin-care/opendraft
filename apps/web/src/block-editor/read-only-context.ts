/**
 * Read-only mode of the block editor: the reader renders the same
 * blocks as the author view but without editing. The context carries
 * the flag; {@link useReadOnly} reads it, and this module also holds
 * the saver selection that drops writes while read-only.
 */
import { createContext, useContext, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import type { SaveStatus } from '../components/AppHeader';
import { useDebouncedSaver } from '../components/editor/autosave';
import type { DebouncedSaver } from '../components/editor/autosave';
import type { CrossrefIndexHandle } from '../crossref/use-crossref-index';
import { joinHeading } from './heading';
import type { BlockHeading } from './heading';

/** Whether the surrounding block tree is rendered read-only. */
export const ReadOnlyContext = createContext(false);

/**
 * Read the read-only flag from the nearest {@link ReadOnlyContext}
 * provider.
 *
 * @returns True when blocks under this provider are rendered read-only;
 * false when there is no provider.
 */
export function useReadOnly(): boolean {
  return useContext(ReadOnlyContext);
}

/**
 * Autosave target installed while blocks are read-only: every call is
 * a no-op, so a read-only body never schedules or flushes a write.
 */
export const INERT_SAVER: DebouncedSaver = {
  setPath: () => undefined,
  schedule: () => undefined,
  flush: () => undefined,
};

/** Word-count sink carried in the props; absent means no reporter. */
export type WordCountSink = ((count: number) => void) | undefined;

/**
 * Count whitespace-separated words in a markdown body.
 *
 * @param text - Markdown text, typically the block body.
 * @returns The number of words; 0 for blank text.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/**
 * Keep the latest value in a ref so a changing callback or object never
 * retriggers the effects that read it.
 *
 * @param value - The current render's value.
 * @returns A ref whose `current` always holds the latest value.
 */
export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/** Extra wiring for {@link useJoinedSaver}. */
interface JoinedSaverOptions {
  /** Receives the edited body's word count. */
  onWordCountRef: RefObject<WordCountSink>;
  /** Cross-reference index kept in sync with the saved text. */
  crossrefsRef: RefObject<CrossrefIndexHandle | undefined>;
  /** Block file name the joined text belongs to. */
  file: string;
}

/**
 * Wrap a debounced saver so scheduled markdown is rejoined onto the
 * block's canonical heading and its words are reported upward before
 * the save is queued.
 *
 * @param saver - Debounced autosave target for the block file.
 * @param headingRef - Heading captured at load; reattached verbatim.
 * @param options - Word-count sink, cross-reference index and file name.
 * @returns A saver handle whose identity is stable across renders.
 */
export function useJoinedSaver(
  saver: DebouncedSaver,
  headingRef: RefObject<BlockHeading>,
  options: JoinedSaverOptions,
): DebouncedSaver {
  const { onWordCountRef, crossrefsRef, file } = options;
  return useMemo(
    () => ({
      setPath: (path: string) => saver.setPath(path),
      schedule: (markdown: string) => {
        onWordCountRef.current?.(countWords(markdown));
        const joined = joinHeading(headingRef.current, markdown);
        crossrefsRef.current?.updateFile(file, joined);
        saver.schedule(joined);
      },
      flush: () => saver.flush(),
    }),
    [saver, file],
  );
}

/** Options for {@link useBodySaver}. */
interface BodySaverOptions {
  /** Workspace holding the block file. */
  ws: WorkspaceAdapter;
  /** Block file path. */
  path: string;
  /** Block file name the joined text belongs to. */
  file: string;
  /** Whether the body is read-only. */
  readOnly: boolean;
  /** Heading captured at load; reattached verbatim. */
  headingRef: RefObject<BlockHeading>;
  /** Receives the edited body's word count. */
  onWordCountRef: RefObject<WordCountSink>;
  /** Cross-reference index kept in sync with the saved text. */
  crossrefsRef: RefObject<CrossrefIndexHandle | undefined>;
  /** Reports autosave progress so the header can display it. */
  onSaveStatus?: (status: SaveStatus) => void;
}

/**
 * Select the body's autosave target: read-only bodies get the inert
 * saver that drops every scheduled write, editable bodies get the
 * shared debounced saver, both rejoined onto the canonical heading.
 *
 * @param options - See {@link BodySaverOptions}.
 * @returns The joined saver handle used for the block body.
 */
export function useBodySaver(options: BodySaverOptions): DebouncedSaver {
  const { ws, path, file, readOnly, headingRef, onWordCountRef, crossrefsRef, onSaveStatus } = options;
  const saver = useDebouncedSaver(ws, path, readOnly ? undefined : onSaveStatus);
  return useJoinedSaver(readOnly ? INERT_SAVER : saver, headingRef, {
    onWordCountRef, crossrefsRef, file,
  });
}
