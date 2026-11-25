/**
 * Reader banner announcing that a newer commit of the repository is available.
 */

import { READER_COPY } from './reader-copy';

/** Props for {@link ReaderUpdateBanner}. */
export interface ReaderUpdateBannerProps {
  /** Reload the repository at its latest commit. */
  onRefresh: () => void;
}

/**
 * Render the newer-version banner and its refresh action.
 *
 * @param props - See {@link ReaderUpdateBannerProps}.
 * @returns The banner with the update message and refresh button.
 */
export function ReaderUpdateBanner({ onRefresh }: ReaderUpdateBannerProps) {
  return (
    <section className="flex flex-col gap-3 rounded-md border border-outline p-4">
      <p className="text-sm text-black">{READER_COPY.update}</p>
      <button
        type="button"
        onClick={onRefresh}
        className="self-start rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {READER_COPY.refresh}
      </button>
    </section>
  );
}

export default ReaderUpdateBanner;
