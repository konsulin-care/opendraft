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

/** Row content-box geometry used for measurement. */
interface ContentBox {
  /** Distance from the viewport left edge to the row's content start. */
  left: number;
  /** Row content-box width, excluding horizontal padding. */
  width: number;
}

/**
 * Read the row's content box: the border-box rect narrowed by its computed
 * horizontal padding, so item edges (measured from the content start) and
 * the available width share one origin.
 *
 * @param row - The row element to measure.
 * @returns The content start's left offset and the content-box width.
 */
function readContentBox(row: HTMLElement): ContentBox {
  const rect = row.getBoundingClientRect();
  const style = getComputedStyle(row);
  const padLeft = Number.parseFloat(style.paddingLeft) || 0;
  const padRight = Number.parseFloat(style.paddingRight) || 0;
  return { left: rect.left + padLeft, width: rect.width - padLeft - padRight };
}

/** Values read by a single measurement pass. */
interface Measurement {
  /** Right edge of each item from the row content start, in index order. */
  edges: readonly number[];
  /** More trigger width, or null when it is unmounted (everything fits). */
  moreWidth: number | null;
  /** Row content-box width from the same pass. */
  contentWidth: number;
}

/**
 * Run one measurement pass: read every item's right edge relative to the row
 * content start, the More trigger's width when it is mounted, and the row's
 * content-box width.
 *
 * @param row - The row element to measure.
 * @param itemElements - Item elements by index, collected via ref callbacks.
 * @param itemCount - Number of items expected in the measurement pass.
 * @param more - The More trigger element, or null while it is unmounted.
 * @returns The measured edges, More width, and content width.
 */
function measureRow(
  row: HTMLElement,
  itemElements: Array<HTMLElement | null>,
  itemCount: number,
  more: HTMLElement | null,
): Measurement {
  const { left, width } = readContentBox(row);
  itemElements.length = itemCount;
  const edges = itemElements.map((element) =>
    element ? element.getBoundingClientRect().right - left : 0,
  );
  return { edges, moreWidth: more ? more.getBoundingClientRect().width : null, contentWidth: width };
}

/**
 * Observe the row element; each resize notification re-reads only the row's
 * content-box width so the count can be recomputed from cached edges.
 *
 * @param row - The row element to observe, or null to skip.
 * @param onWidth - Callback receiving the row's content-box width.
 * @returns A cleanup that disconnects the observer, or undefined when the
 *   row is missing or the environment has no ResizeObserver (e.g. jsdom).
 */
function observeRow(
  row: HTMLElement | null,
  onWidth: (width: number) => void,
): (() => void) | undefined {
  if (!row || typeof ResizeObserver === 'undefined') return undefined;
  const observer = new ResizeObserver(() => onWidth(readContentBox(row).width));
  observer.observe(row);
  return () => observer.disconnect();
}

/**
 * Measure toolbar overflow from real element positions. On each item-set
 * change one measurement pass reads every item's right edge relative to the
 * row content start, plus the More trigger's width and the row's content-box
 * width; the edges and the More width are then cached. The row is observed
 * with a ResizeObserver, and each callback re-reads only the row's
 * content-box width to recompute the count from the cached edges — items are
 * never re-measured on resize and the window width is never read. The count
 * comes from the pure {@link computeFitCount} function, so a pinned item is
 * always included in the visible prefix.
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
  const [edges, setEdges] = useState<readonly number[]>([]);
  const [moreWidth, setMoreWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  // One measurement pass per item-set change (see measureRow). When the
  // More trigger is unmounted (everything fits), its cached width is kept.
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measured = measureRow(row, itemElements.current, itemCount, moreRef.current);
    setEdges(measured.edges);
    if (measured.moreWidth !== null) setMoreWidth(measured.moreWidth);
    setContentWidth(measured.contentWidth);
  }, [itemCount]);

  // Resize notifications re-read only the row's content-box width; cached
  // item edges are untouched here.
  useLayoutEffect(() => observeRow(rowRef.current, setContentWidth), [itemCount]);

  const setItemRef = useCallback(
    (index: number) => (element: HTMLElement | null) => {
      itemElements.current[index] = element;
    },
    [],
  );

  const visibleCount = useMemo(
    () => computeFitCount({ edges, pinned, contentWidth, moreWidth, gap }),
    [edges, pinned, contentWidth, moreWidth, gap],
  );

  return { visibleCount, rowRef, moreRef, setItemRef };
}
