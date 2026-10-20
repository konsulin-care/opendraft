import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { computeFitCount } from './fit-count';

/** Default gap between row elements, matching the `gap-0.5` utility (2px). */
const DEFAULT_GAP = 2;

/** Options for {@link useOverflowCount}. */
export interface UseOverflowCountOptions {
  /** Number of items in the priority-ordered list; a change re-measures. */
  itemCount: number;
  /** Whether the item at the same index is pinned and must stay visible. */
  pinned: readonly boolean[];
  /** Gap between adjacent elements in the row, in pixels. Defaults to 2. */
  gap?: number;
}

/** Refs and visible count returned by {@link useOverflowCount}. */
export interface OverflowCountHandle {
  /** Number of items to render inline before the More trigger. */
  visibleCount: number;
  /** Ref for the toolbar row element observed with ResizeObserver. */
  rowRef: RefObject<HTMLDivElement | null>;
  /** Ref for the More trigger whose width is reserved when items are hidden. */
  moreRef: RefObject<HTMLElement | null>;
  /** Builds a ref callback attaching the element at `index` for measurement. */
  setItemRef: (index: number) => (element: HTMLElement | null) => void;
}

/**
 * Measure toolbar overflow from real element widths. Each item's width (and
 * the More trigger's and the row's) is read once per item-set change, keyed
 * on `itemCount`; the row is then observed with a ResizeObserver and the
 * visible count is recomputed from the row's own width on resize callbacks
 * only — the window width is never read. The count comes from the pure
 * {@link computeFitCount} function, so a pinned item is always included in
 * the visible prefix.
 *
 * @param options - See {@link UseOverflowCountOptions}.
 * @returns Refs to attach to the row, items, and More trigger, plus the
 *   current visible item count.
 */
export function useOverflowCount({
  itemCount,
  pinned,
  gap = DEFAULT_GAP,
}: UseOverflowCountOptions): OverflowCountHandle {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const moreRef = useRef<HTMLElement | null>(null);
  const itemElements = useRef<Array<HTMLElement | null>>([]);
  const [widths, setWidths] = useState<readonly number[]>([]);
  const [moreWidth, setMoreWidth] = useState(0);
  const [rowWidth, setRowWidth] = useState(0);

  // Re-measure the items, the More trigger, and the row when the item set changes.
  useLayoutEffect(() => {
    itemElements.current.length = itemCount;
    setWidths(itemElements.current.map((element) => element?.getBoundingClientRect().width ?? 0));
    setMoreWidth(moreRef.current?.getBoundingClientRect().width ?? 0);
    setRowWidth(rowRef.current?.getBoundingClientRect().width ?? 0);
  }, [itemCount]);

  // Observe the row element; resize notifications re-read the row's width,
  // which drives the recomputation below. Item widths are untouched here.
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const observer = new ResizeObserver(() => setRowWidth(row.getBoundingClientRect().width));
    observer.observe(row);
    return () => observer.disconnect();
  }, [itemCount]);

  const setItemRef = useCallback(
    (index: number) => (element: HTMLElement | null) => {
      itemElements.current[index] = element;
    },
    [],
  );

  const visibleCount = useMemo(
    () => computeFitCount({ widths, pinned, rowWidth, moreWidth, gap }),
    [widths, pinned, rowWidth, moreWidth, gap],
  );

  return { visibleCount, rowRef, moreRef, setItemRef };
}
