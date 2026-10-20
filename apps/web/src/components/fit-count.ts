/** Inputs for {@link computeFitCount}. */
export interface FitCountInput {
  /**
   * Measured right edge of each toolbar item from the row content start, in
   * priority order, including any divider rendered before the item and the
   * group gaps.
   */
  edges: readonly number[];
  /** Whether the item at the same index is pinned and must stay visible. */
  pinned: readonly boolean[];
  /** Row content-box width, in pixels. */
  contentWidth: number;
  /** Measured width of the More trigger, in pixels. */
  moreWidth: number;
  /** Gap between the last visible item and the More trigger, in pixels. */
  gap: number;
}

/**
 * Computes how many toolbar items fit inline in the row from measured right
 * edges, as the largest prefix of the priority-ordered item list. When every
 * item fits (the last edge is within the content box) the full count is
 * returned with no More slot reserved. Otherwise the count is the largest
 * prefix whose last edge still leaves room for the gap and the More trigger
 * (the More trigger's own width alone when the count is 0). Pinned items are
 * always included in the visible prefix, even when that overflows the row.
 *
 * Callers can derive the More slot as `count < edges.length`.
 *
 * @param input - See {@link FitCountInput}.
 * @returns The number of items to render inline (0 when nothing fits and
 *   nothing is pinned).
 */
export function computeFitCount({
  edges,
  pinned,
  contentWidth,
  moreWidth,
  gap,
}: FitCountInput): number {
  const total = edges.length;
  if (total === 0) return 0;

  // All items fit inline: no More slot is reserved.
  if (edges[total - 1] <= contentWidth) return total;

  // Largest prefix whose measured edge still leaves room for the gap and the
  // More slot. Edges are non-decreasing, so stop at the first overflow.
  let fitting = 0;
  for (let count = 1; count < total; count++) {
    if (edges[count - 1] + gap + moreWidth > contentWidth) break;
    fitting = count;
  }

  // Pinned items are always in the visible prefix: extend the count to cover
  // the last pinned item.
  let lastPinned = -1;
  for (let i = total - 1; i >= 0; i--) {
    if (pinned[i]) {
      lastPinned = i;
      break;
    }
  }

  return Math.max(fitting, lastPinned + 1);
}
