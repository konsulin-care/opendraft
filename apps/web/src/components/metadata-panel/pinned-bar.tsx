/**
 * Sticky pinned bar of the metadata panel: title, byline and chevron
 * toggle, closed off by the 1px hairline separator. The bar stays
 * sticky inside the editor scroll container while the expanded body
 * scrolls away 1:1; the bar text fades in through the panel's
 * `--collapse-progress` CSS variable.
 */
import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/** Props for {@link PinnedBar}. */
export interface PinnedBarProps {
  /** Manuscript title shown in the bar while collapsed. */
  title: string;
  /** Manuscript folder id shown in muted text when the title is empty. */
  folderId: string;
  /** Byline shown in the bar while collapsed. */
  byline: string;
  /** Effective expanded state (false also while scroll-collapsed). */
  expanded: boolean;
  /** Collapse progress in the 0..1 range driving the text fade-in. */
  collapseProgress: number;
  /** Whether the viewport is below the 640px breakpoint. */
  narrow: boolean;
  /** Optional element rendered between the title block and the toggle. */
  badge?: ReactNode;
  /** Chevron toggle handler. */
  onToggle: () => void;
}

/**
 * Pinned bar: title, byline and chevron toggle, closed off by the 1px
 * hairline separator below it. The bar and the separator share one
 * sticky container so the hairline stays pinned under the bar for the
 * whole scroll range; the bar text fades in with the panel's
 * `--collapse-progress` CSS variable. An empty title falls back to the
 * manuscript folder id in muted text instead of a placeholder label.
 * The title wraps onto as many lines as it needs; the byline stays a
 * single truncated line.
 *
 * @param props - See {@link PinnedBarProps}.
 * @returns The sticky wrapper containing the bar and separator.
 */
export function PinnedBar({
  title, folderId, byline, expanded, collapseProgress, badge, onToggle,
}: PinnedBarProps): ReactNode {
  // While explicitly collapsed the text is fully opaque; while expanded
  // it fades in with the collapse progress written by the scroll hook.
  const textStyle = { opacity: expanded ? 'var(--collapse-progress, 0)' : 1 };
  const showText = !expanded || collapseProgress > 0;
  return (
    <div className="sticky top-0 z-10 bg-white">
      <div
        className="flex items-center gap-2 py-2"
        data-testid="metadata-panel-bar"
      >
        <div className="min-w-0 flex-1">
          {showText && (
            <div style={textStyle}>
              <div
                data-testid="metadata-panel-bar-title"
                className="break-words [overflow-wrap:anywhere]"
              >
                {title || <span className="text-muted">{folderId}</span>}
              </div>
              {byline && (
                <div className="truncate text-sm text-muted" data-testid="metadata-panel-byline">{byline}</div>
              )}
            </div>
          )}
        </div>
        {badge}
        <button
          type="button"
          data-testid="metadata-panel-toggle"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse manuscript metadata' : 'Expand manuscript metadata'}
          onClick={onToggle}
          className="flex min-h-11 min-w-11 items-center justify-center rounded hover:bg-hover"
        >
          {expanded ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
        </button>
      </div>
      <div data-testid="metadata-panel-separator" className="h-px bg-secondary" />
    </div>
  );
}
