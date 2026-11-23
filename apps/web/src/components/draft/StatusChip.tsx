/**
 * Header status chip for the draft workflow.
 *
 * The chip shows the draft status in plain language. Clicking it opens a
 * popover that explains where the copy lives, names the draft, and links to
 * the suggestion pull request when one exists. A transient notice may replace
 * the chip label briefly after an action completes.
 */

import { useEffect, useRef, useState } from 'react';
import { useOutsideClose } from '../HeaderOverflowMenu';

/** Props for {@link StatusChip}. */
export interface StatusChipProps {
  /** Status text, e.g. `Draft`, `Sent for review` or `Accepted`. */
  label: string;
  /** Owner of the viewer's copy. */
  owner?: string;
  /** Repository name of the viewer's copy. */
  repo?: string;
  /** Name of the draft branch. */
  draftName?: string;
  /** Alias for {@link StatusChipProps.draftName}. */
  name?: string;
  /** Browser URL of the suggestion pull request, when one exists. */
  pullRequestUrl?: string;
  /** Alias for {@link StatusChipProps.pullRequestUrl}. */
  prUrl?: string;
  /** Alias for {@link StatusChipProps.pullRequestUrl}. */
  suggestionUrl?: string;
  /** Transient message that replaces the label for a few seconds. */
  notice?: string | null;
}

/** How long a transient notice replaces the chip label, in milliseconds. */
const NOTICE_MS = 4000;

const CHIP =
  'inline-flex min-h-6 items-center rounded-full border border-gray-300 bg-gray-100 px-2 text-xs font-medium text-gray-700 hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500';
const PANEL =
  'absolute right-0 top-full z-40 mt-2 w-72 rounded-md border border-gray-200 bg-white p-4 text-left shadow-lg';
const LINK =
  'inline-flex text-sm font-medium text-blue-700 underline hover:text-blue-900';

/**
 * Resolve the pull request URL from the accepted prop aliases.
 *
 * @param props - Chip props that may carry a URL under any alias.
 * @returns The first defined URL, or undefined when there is no pull request.
 */
function resolvePullUrl(props: StatusChipProps): string | undefined {
  return props.pullRequestUrl ?? props.prUrl ?? props.suggestionUrl;
}

/**
 * Resolve the viewer's copy path from the owner and repository props.
 *
 * @param owner - Owner of the copy, when known.
 * @param repo - Repository of the copy, when known.
 * @returns `owner/repo`, or an empty string when either part is missing.
 */
function copyPath(owner: string | undefined, repo: string | undefined): string {
  return owner && repo ? `${owner}/${repo}` : '';
}

/** Close an open popover when Escape is pressed. */
function useEscapeClose(open: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);
}

/** Props for {@link ChipPopover}. */
interface ChipPopoverProps {
  owner?: string;
  repo?: string;
  draftName?: string;
  pullUrl?: string;
}

/**
 * Popover content: where the copy lives, the draft name and the PR link.
 *
 * @param props - See {@link ChipPopoverProps}.
 */
function ChipPopover({ owner, repo, draftName, pullUrl }: ChipPopoverProps) {
  const path = copyPath(owner, repo);
  return (
    <div role="dialog" aria-label="Draft details" className={PANEL}>
      <p className="text-sm text-gray-700">
        {path
          ? `Your copy of ${path} · Changes are saved in this browser`
          : 'Changes are saved in this browser'}
      </p>
      {draftName ? (
        <p className="mt-2 break-all text-sm font-medium text-gray-900">{draftName}</p>
      ) : null}
      {pullUrl ? (
        <a href={pullUrl} target="_blank" rel="noreferrer" className={`mt-3 ${LINK}`}>
          View suggestion ↗
        </a>
      ) : null}
    </div>
  );
}

/**
 * Render the draft status chip with its explanation popover.
 *
 * The chip label is replaced by `notice` for a few seconds whenever a new
 * notice arrives. Clicking the chip toggles a popover that names the viewer's
 * copy, the draft, and the suggestion pull request when one exists.
 *
 * @param props - See {@link StatusChipProps}.
 * @returns The chip button and its optional popover.
 */
export function StatusChip(props: StatusChipProps) {
  const { label, owner, repo, notice } = props;
  const draftName = props.draftName ?? props.name;
  const pullUrl = resolvePullUrl(props);
  const [menuOpen, setMenuOpen] = useState(false);
  const [visibleNotice, setVisibleNotice] = useState<string | null>(notice ?? null);
  const chipRef = useRef<HTMLDivElement | null>(null);
  const closeMenu = useRef(() => setMenuOpen(false)).current;
  useOutsideClose(menuOpen, chipRef, closeMenu);
  useEscapeClose(menuOpen, closeMenu);

  useEffect(() => {
    setVisibleNotice(notice ?? null);
    if (!notice) return undefined;
    const timer = setTimeout(() => setVisibleNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  return (
    <div className="relative inline-flex" ref={chipRef}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
        className={CHIP}
      >
        {visibleNotice ?? label}
      </button>
      {menuOpen ? (
        <ChipPopover owner={owner} repo={repo} draftName={draftName} pullUrl={pullUrl} />
      ) : null}
    </div>
  );
}

export default StatusChip;
