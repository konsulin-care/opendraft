import { Check, ChevronDown, CircleAlert, LoaderCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { RefObject } from 'react';
import type { SaveStatus } from '../AppHeader';
import { useTransientNotice } from './use-transient-notice';

/** Icon and label used for each autosave state. */
export interface SaveStateEntry {
  /** Plain-language label announced by the status region. */
  label: string;
  /** Icon rendered beside the label. */
  Icon: LucideIcon;
  /** Colour and motion classes applied to the icon. */
  iconClass: string;
}

/** Autosave state glyphs and labels shared with the header. */
export const SAVE_STATE: Record<SaveStatus, SaveStateEntry> = {
  saving: { label: 'Saving', Icon: LoaderCircle, iconClass: 'animate-spin text-gray-500' },
  saved: { label: 'Saved', Icon: Check, iconClass: 'text-green-700' },
  error: { label: 'Save failed', Icon: CircleAlert, iconClass: 'text-red-700' },
};

/** Fallback title shown when the manuscript has no display name yet. */
const FALLBACK_TITLE = 'Manuscript';

/** Props for {@link TitleTrigger}. */
export interface TitleTriggerProps {
  /** Display name of the open manuscript. */
  title?: string;
  /** Whether the details panel is open. */
  open: boolean;
  /** Id of the panel the trigger controls. */
  panelId: string;
  /** Called when the trigger is activated. */
  onToggle: () => void;
  /** Receives the button element so the panel can return focus to it. */
  triggerRef?: RefObject<HTMLButtonElement | null>;
  /** Current autosave state; omit it for a header without save status. */
  saveStatus?: SaveStatus;
  /** Transient message that replaces the status label for a few seconds. */
  notice?: string | null;
  /** Marks that the manuscript needs attention, e.g. a waiting draft. */
  attention?: boolean;
}

/** Props for the internal save-status region. */
interface StatusRegionProps {
  /** Plain-language save label. */
  label: string;
  /** Save glyph for the current state. */
  Icon: LucideIcon;
  /** Colour and motion classes for the glyph. */
  iconClass: string;
  /** Notice currently replacing the label, if any. */
  notice: string | null;
}

/**
 * Polite live region announcing the autosave state.
 *
 * The glyph is always visible; the label is screen-reader-only below `md` and
 * visible from `md` up, while an active notice replaces it at every width.
 *
 * @param props - See {@link StatusRegionProps}.
 * @returns The status live region.
 */
function StatusRegion({ label, Icon, iconClass, notice }: StatusRegionProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className="flex min-w-0 shrink-0 items-center gap-1 text-xs text-gray-600"
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${iconClass}`} aria-hidden="true" />
      <span
        className={
          notice ? 'inline max-w-[40vw] truncate text-gray-900' : 'sr-only md:not-sr-only'
        }
      >
        {notice ?? label}
      </span>
    </span>
  );
}

/**
 * Title button plus its polite save-status region.
 *
 * The button shows the manuscript title, a chevron that rotates while the
 * details panel is open, and an amber dot when the manuscript needs attention
 * or the last save failed. The neighbouring status region carries the save
 * glyph; its label is screen-reader-only below `md` and visible from `md` up,
 * while a transient notice replaces the label at every width. Without a save
 * status the region is not rendered at all, so the reader header reuses the
 * same trigger without an autosave state.
 *
 * @param props - See {@link TitleTriggerProps}.
 * @returns The disclosure trigger and, with a save status, its live region.
 */
export function TitleTrigger({
  title,
  open,
  panelId,
  onToggle,
  triggerRef,
  saveStatus,
  notice,
  attention,
}: TitleTriggerProps) {
  const visibleNotice = useTransientNotice(notice);
  const saveState = saveStatus === undefined ? undefined : SAVE_STATE[saveStatus];
  const showDot = attention === true || saveStatus === 'error';

  return (
    <span className="flex min-w-0 items-center gap-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        ref={triggerRef}
        className="inline-flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-sm font-semibold text-gray-900 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500"
      >
        <span className="truncate">{title ?? FALLBACK_TITLE}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
        {showDot && (
          <span
            data-testid="title-trigger-attention"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
            aria-hidden="true"
          />
        )}
      </button>
      {saveState !== undefined && (
        <StatusRegion
          label={saveState.label}
          Icon={saveState.Icon}
          iconClass={saveState.iconClass}
          notice={visibleNotice}
        />
      )}
    </span>
  );
}
