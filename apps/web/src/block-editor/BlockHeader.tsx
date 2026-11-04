/**
 * Block header: the collapsible block's title row, owning the H1 title,
 * the copyable `@sec-` reference chip, the word count, the save status
 * and the overflow menu. The disclosure toggle carries `aria-expanded`.
 */
import { ChevronDown, Ellipsis } from 'lucide-react';
import type { SaveStatus } from '../components/AppHeader';

/** Save-status labels, mirroring the app header indicator. */
const SAVE_LABEL: Record<SaveStatus, string> = {
  saved: 'Saved',
  saving: 'Saving',
  error: 'Save failed',
};

/** Props for {@link BlockHeader}. */
export interface BlockHeaderProps {
  /** Block short name — the file name without `.qmd`. */
  short: string;
  /** Section title rendered as the header H1. */
  title: string;
  /** Whether the block body is collapsed. */
  collapsed: boolean;
  /** Flip the collapsed state; wired to the disclosure toggle. */
  onToggle: () => void;
  /** Word count of the section body. */
  wordCount: number;
  /** Autosave state shown next to the word count. */
  saveStatus: SaveStatus;
  /** Open the block's overflow menu. */
  onOverflow?: () => void;
}

/**
 * Copyable `@sec-<short>` chip.
 *
 * @param props - The block short name the reference is built from.
 * @returns The chip button; activation copies `@sec-<short>` to the clipboard.
 */
function CopyChip({ short }: { short: string }) {
  const copyReference = (): void => {
    void navigator.clipboard?.writeText(`@sec-${short}`).catch(() => {
      // Clipboard unavailable: the chip keeps showing the reference.
    });
  };
  return (
    <button
      type="button"
      aria-label={`Copy @sec-${short} reference`}
      onClick={copyReference}
      className="rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
    >
      <code>@sec-{short}</code>
    </button>
  );
}

/**
 * Header row of one block: disclosure toggle, H1 title, reference chip,
 * word count, save status and overflow menu.
 *
 * @param props - See {@link BlockHeaderProps}.
 * @returns The rendered header markup.
 */
export function BlockHeader({
  short,
  title,
  collapsed,
  onToggle,
  wordCount,
  saveStatus,
  onOverflow,
}: BlockHeaderProps) {
  return (
    <header className="flex items-center gap-2 border-b border-gray-200 px-3 py-2">
      <button
        type="button"
        aria-label={`${title} section`}
        aria-expanded={!collapsed}
        onClick={onToggle}
        className="inline-flex items-center justify-center rounded-md p-1 text-gray-500 hover:bg-gray-100"
      >
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 transition-transform ${collapsed ? '-rotate-90' : ''}`}
        />
      </button>
      <h1 className="flex-1 truncate text-base font-semibold text-gray-900">{title}</h1>
      <CopyChip short={short} />
      <span className="text-xs text-gray-500">
        {wordCount} {wordCount === 1 ? 'word' : 'words'}
      </span>
      <span role="status" aria-live="polite" className="text-xs text-gray-600">
        {SAVE_LABEL[saveStatus]}
      </span>
      <button
        type="button"
        aria-label="Block options"
        onClick={onOverflow}
        className="inline-flex items-center justify-center rounded-md p-1 text-gray-500 hover:bg-gray-100"
      >
        <Ellipsis aria-hidden="true" className="h-4 w-4" />
      </button>
    </header>
  );
}
