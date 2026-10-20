/** Inputs for {@link computeFitCount}. */
export interface FitCountInput {
  /** Measured width of each toolbar item, in priority order. */
  widths: readonly number[];
  /** Whether the item at the same index is pinned and must stay visible. */
  pinned: readonly boolean[];
  /** Available width of the toolbar row. */
  rowWidth: number;
  /** Measured width of the More trigger. */
  moreWidth: number;
  /** Gap between adjacent elements, including the gap before the More trigger. */
  gap: number;
}

/**
 * Computes how many toolbar items fit inline in the row, as the largest
 * prefix of the priority-ordered item list. The More trigger's slot is
 * reserved only when at least one item is hidden; if every item fits, the
 * full count is returned and no More slot is needed. Pinned items are always
 * included in the visible prefix, even when that exceeds the row width.
 *
 * Callers can derive the More slot as `count < widths.length`.
 *
 * @param input - See {@link FitCountInput}.
 * @returns The number of items to render inline (0 when nothing fits and
 *   nothing is pinned).
 */
export function computeFitCount({
  widths,
  pinned,
  rowWidth,
  moreWidth,
  gap,
}: FitCountInput): number {
  const total = widths.length;
  if (total === 0) return 0;

  // prefix[i] = summed width of the first i items.
  const prefix: number[] = new Array<number>(total + 1);
  prefix[0] = 0;
  for (let i = 0; i < total; i++) prefix[i + 1] = prefix[i] + widths[i];

  // All items fit inline: no More slot is reserved.
  const allItemsCost = prefix[total] + gap * (total - 1);
  if (allItemsCost <= rowWidth) return total;

  // Cost of showing `count` items plus the reserved More slot: item widths,
  // gaps between adjacent items, one gap before the More trigger, and the
  // More trigger itself.
  const costWithMore = (count: number): number => {
    if (count === 0) return moreWidth;
    return prefix[count] + gap * count + moreWidth;
  };

  // Largest prefix that fits together with the More slot. Costs are
  // monotonically increasing, so stop at the first overflow.
  let fitting = 0;
  for (let count = 0; count < total; count++) {
    if (costWithMore(count) > rowWidth) break;
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

  return Math.min(total, Math.max(fitting, lastPinned + 1));
}
