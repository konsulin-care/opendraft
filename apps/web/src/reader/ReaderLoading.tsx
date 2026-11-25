/**
 * Reader loading indicator: a spinner, the phase label and the first-visit
 * note.
 */

import { LoaderCircle } from 'lucide-react';
import type { LoadPhase } from './load-repo';
import { phaseLabel, READER_COPY } from './reader-copy';

/** Props for {@link ReaderLoading}. */
export interface ReaderLoadingProps {
  /** Current loading phase. */
  phase: LoadPhase;
  /** Repository owner shown in the checking label. */
  owner: string;
  /** Repository name shown in the checking label. */
  repo: string;
  /** Whether to add the download-once note. */
  firstVisit: boolean;
}

/**
 * Render the busy status region shown while the reader loads.
 *
 * @param props - See {@link ReaderLoadingProps}.
 * @returns The status region with spinner, label and optional note.
 */
export function ReaderLoading({ phase, owner, repo, firstVisit }: ReaderLoadingProps) {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="reader-loading"
      className="flex flex-col items-center gap-3 rounded-md border border-outline p-4"
    >
      <LoaderCircle
        aria-hidden="true"
        className="h-5 w-5 animate-spin motion-reduce:animate-none"
      />
      <p className="text-sm font-medium text-black">{phaseLabel(phase, owner, repo)}</p>
      {firstVisit ? <p className="text-xs text-gray-600">{READER_COPY.firstVisit}</p> : null}
    </section>
  );
}

export default ReaderLoading;
