/**
 * Block header: the collapsible block's title row, owning the H1 title,
 * the copyable `@sec-` reference chip, the level-1 warning badge, the
 * word count, the save status and the overflow menu. The disclosure
 * toggle carries `aria-expanded`. The warning badge reflects the body
 * as loaded: new level-1 headings cannot appear because the body's
 * heading guard demotes them to H2.
 */
import { useSyncExternalStore } from 'react';
import { ChevronDown, Ellipsis } from 'lucide-react';
import type { SaveStatus } from '../components/AppHeader';

/** Per-block level-1 warnings reported by mounted bodies, keyed by short name. */
const level1Warnings = new Map<string, boolean>();
/** Listeners notified when any block's level-1 warning changes. */
const level1Listeners = new Set<() => void>();

/**
 * Whether a loaded block body carries a level-1 heading (an ATX `# `
 * line outside a fenced code block). The canonical heading line has
 * already been stripped by the caller.
 *
 * @param body - Loaded block body text.
 * @returns True when the body contains a level-1 heading.
 */
function bodyHasLevel1(body: string): boolean {
  let fence: string | null = null;
  for (const line of body.split('\n')) {
    const trimmed = line.trimStart();
    if (fence !== null) {
      if (trimmed.startsWith(fence)) fence = null;
      continue;
    }
    const open = trimmed.match(/^(```|~~~)/);
    if (open) {
      fence = open[1];
      continue;
    }
    if (/^ {0,3}# /.test(line)) return true;
  }
  return false;
}

/**
 * Report a block's loaded body so its header can show a warning badge
 * when the body already contains a level-1 heading. Read-only with
 * respect to the workspace: the file itself is never rewritten here.
 *
 * @param short - Block short name the body belongs to.
 * @param body - Loaded body text with the canonical heading stripped.
 */
export function reportLoadedBody(short: string, body: string): void {
  const hasLevel1 = bodyHasLevel1(body);
  if ((level1Warnings.get(short) ?? false) === hasLevel1) return;
  level1Warnings.set(short, hasLevel1);
  level1Listeners.forEach((listener) => listener());
}

/**
 * Subscribe to level-1 warning changes.
 *
 * @param listener - Called after any block's warning changes.
 * @returns An unsubscribe function.
 */
function subscribeLevel1Warning(listener: () => void): () => void {
  level1Listeners.add(listener);
  return () => {
    level1Listeners.delete(listener);
  };
}

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
 * Amber badge shown when the loaded body already contains a level-1
 * heading; read-only signal rendered only while the warning is on.
 *
 * @returns The warning badge markup.
 */
function Level1Badge() {
  return (
    <span
      data-testid="level-1-warning-badge"
      title="Body contains a level-1 heading"
      className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
    >
      H1 in body
    </span>
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
  const hasLevel1Warning = useSyncExternalStore(
    subscribeLevel1Warning,
    () => level1Warnings.get(short) ?? false,
    () => false,
  );
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
      {hasLevel1Warning && <Level1Badge />}
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
