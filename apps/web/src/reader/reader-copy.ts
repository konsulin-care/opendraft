/**
 * Agreed reader copy in one place: phase labels, the first-visit note, the
 * update banner and the PWA toast.
 */

import type { LoadPhase } from './load-repo';

/** Phase labels and notes shown while the reader loads a repository. */
export interface ReaderCopy {
  /** Label for the commit lookup of an owner/repository pair. */
  checking: (owner: string, repo: string) => string;
  /** Label while restoring a cached snapshot. */
  opening: string;
  /** Label while downloading files from GitHub. */
  downloading: string;
  /** Label while saving the snapshot to the browser cache. */
  saving: string;
  /** Label while turning repository files into a workspace. */
  preparing: string;
  /** Label while scanning a non-OpenDraft repository for manuscripts. */
  discovering: string;
  /** Note shown on the first visit to a repository. */
  firstVisit: string;
  /** Message shown when a newer commit is available. */
  update: string;
  /** Label of the button that reloads the newer version. */
  refresh: string;
  /** Message shown when a new OpenDraft build is available. */
  pwaUpdate: string;
  /** Label of the button that reloads the new build. */
  reload: string;
  /** Label of the button that dismisses the new-build toast. */
  close: string;
}

/** The agreed reader copy. */
export const READER_COPY: ReaderCopy = {
  checking: (owner, repo) => `Checking for the latest version of ${owner}/${repo}…`,
  opening: 'Opening your saved copy…',
  downloading: 'Downloading the manuscript from GitHub…',
  saving: 'Saving a copy for faster loading next time…',
  preparing: 'Preparing the manuscript…',
  discovering: 'Looking for manuscripts in this repository…',
  firstVisit:
    'The first visit downloads the manuscript. Next time it opens straight from your browser.',
  update: 'A newer version is available.',
  refresh: 'Refresh',
  pwaUpdate: 'A new version of OpenDraft is available.',
  reload: 'Reload',
  close: 'Close',
};

/** Every phase that has reader copy, including the non-OpenDraft discovery. */
export type ReaderCopyPhase = LoadPhase | 'discovering';

/**
 * Return the loading label for a phase.
 *
 * @param phase - Current loading phase.
 * @param owner - Repository owner, used by the checking label.
 * @param repo - Repository name, used by the checking label.
 * @returns The agreed label for the phase.
 */
export function phaseLabel(phase: LoadPhase, owner: string, repo: string): string {
  return phaseCopy(phase, owner, repo);
}

/** Build the label for a phase that may also be raw discovery. */
function phaseCopy(phase: ReaderCopyPhase, owner: string, repo: string): string {
  if (phase === 'checking') return READER_COPY.checking(owner, repo);
  return READER_COPY[phase];
}
