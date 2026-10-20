import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import { useOverflowCount } from './use-overflow-count';
import type { UseOverflowCountOptions } from './use-overflow-count';

/** Mock ResizeObserver recorded per test so resize notifications can fire. */
class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();

  /**
   * Record the instance and keep the resize callback.
   *
   * @param callback - Callback invoked on resize notifications.
   */
  constructor(private readonly callback: ResizeObserverCallback) {
    MockResizeObserver.instances.push(this);
  }

  /** Fire the stored callback to simulate a resize notification. */
  trigger(): void {
    this.callback([], this as unknown as ResizeObserver);
  }
}

/** Rect geometry served by the `getBoundingClientRect` stub, keyed by testid. */
interface RectConfig {
  /** Left edge of the row, the origin item edges are measured from. */
  rowLeft: number;
  /** Row border-box width; jsdom applies no padding, so it equals the content width. */
  rowWidth: number;
  /** Width of the More trigger. */
  moreWidth: number;
  /** Widths of the item elements, in index order. */
  itemWidths: number[];
}

/** Latest rect config so tests can mutate it between resize notifications. */
let rects: RectConfig;

/** Start of the element with the given testid, relative to the row left edge. */
function offsetOf(testid: string, config: RectConfig): number {
  if (!testid.startsWith('item-')) return 0;
  const index = Number(testid.slice('item-'.length));
  let offset = 0;
  for (let i = 0; i < index; i++) offset += config.itemWidths[i] ?? 0;
  return offset;
}

/** Width of the element with the given testid. */
function widthOf(testid: string, config: RectConfig): number {
  if (testid === 'row') return config.rowWidth;
  if (testid === 'more') return config.moreWidth;
  if (testid.startsWith('item-')) return config.itemWidths[Number(testid.slice('item-'.length))] ?? 0;
  return 0;
}

/**
 * Stub element rects: the row, the More trigger, and each item are served
 * from `rects` lazily, so tests can mutate the config and re-trigger the
 * observer to simulate resizes. Item right edges accumulate from the row's
 * left edge, matching real layout in one row with no padding.
 */
function stubRects(): void {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element,
  ) {
    const testid = (this as HTMLElement).dataset?.testid ?? '';
    const left = testid === 'row' ? rects.rowLeft : rects.rowLeft + offsetOf(testid, rects);
    const width = widthOf(testid, rects);
    return {
      width,
      height: 0,
      x: left,
      y: 0,
      top: 0,
      left,
      bottom: 0,
      right: left + width,
      toJSON: () => ({}),
    } as DOMRect;
  });
}

/** Latest mock observer, or a descriptive throw when none was constructed. */
function latestObserver(): MockResizeObserver {
  const instance = MockResizeObserver.instances.at(-1);
  if (!instance) throw new Error('ResizeObserver was not constructed');
  return instance;
}

/** Fire the latest observer's resize callback inside `act`. */
function triggerResize(): void {
  act(() => latestObserver().trigger());
}

/** Options for the {@link Probe} harness. */
interface ProbeProps {
  itemCount: number;
  pinned: readonly boolean[];
}

/**
 * Harness that attaches the hook's row, item, and More refs to real elements
 * and surfaces the visible count as a data attribute.
 *
 * @param props - See {@link ProbeProps}.
 * @returns The harness element tree.
 */
function Probe({ itemCount, pinned }: ProbeProps) {
  const { visibleCount, rowRef, moreRef, setItemRef } = useOverflowCount({ itemCount, pinned });
  return createElement(
    'div',
    { ref: rowRef, 'data-testid': 'row', 'data-count': String(visibleCount) },
    Array.from({ length: itemCount }, (_unused, index) =>
      createElement('span', { key: index, ref: setItemRef(index), 'data-testid': `item-${index}` }),
    ),
    createElement('button', { key: 'more', ref: moreRef, 'data-testid': 'more' }),
  );
}

/** Rendered probe with helpers to read its state. */
interface ProbeView {
  view: RenderResult;
  count: () => number;
  row: () => HTMLElement;
}

/**
 * Render the probe with the given item set.
 *
 * @param itemCount - Number of measured items.
 * @param pinned - Pinned flags passed to the hook.
 * @returns The rendered probe and its helpers.
 */
function renderProbe(itemCount: number, pinned: readonly boolean[] = []): ProbeView {
  const options: UseOverflowCountOptions = { itemCount, pinned };
  const view = render(createElement(Probe, options));
  return {
    view,
    count: () => Number(view.getByTestId('row').dataset.count),
    row: () => view.getByTestId('row'),
  };
}

beforeEach(() => {
  MockResizeObserver.instances = [];
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useOverflowCount — content width drives the count', () => {
  it('reduces the visible count when the row content width shrinks', () => {
    // Edges 32..160, More 32, gap 2: at 150 the count is 3 (130 <= 150 < 162).
    rects = { rowLeft: 10, rowWidth: 150, moreWidth: 32, itemWidths: [32, 32, 32, 32, 32] };
    stubRects();
    const probe = renderProbe(5);
    expect(probe.count()).toBe(3);
    // At 100: edge 64 + 34 = 98 <= 100, but 96 + 34 = 130 > 100.
    rects.rowWidth = 100;
    triggerResize();
    expect(probe.count()).toBe(2);
  });

  it('increases the visible count when the row content width grows', () => {
    rects = { rowLeft: 10, rowWidth: 100, moreWidth: 32, itemWidths: [32, 32, 32, 32, 32] };
    stubRects();
    const probe = renderProbe(5);
    expect(probe.count()).toBe(2);
    // At 400 the last edge (160) fits, so all items return with no More slot.
    rects.rowWidth = 400;
    triggerResize();
    expect(probe.count()).toBe(5);
  });

  it('does not re-measure item rects on resize', () => {
    rects = { rowLeft: 10, rowWidth: 150, moreWidth: 32, itemWidths: [32, 32, 32, 32, 32] };
    stubRects();
    const probe = renderProbe(5);
    expect(probe.count()).toBe(3);
    vi.mocked(Element.prototype.getBoundingClientRect).mockClear();
    // Items would now measure far wider, but resize only re-reads the row, so
    // the cached edges at width 400 still give the full count.
    rects = { rowLeft: 10, rowWidth: 400, moreWidth: 32, itemWidths: [200, 200, 200, 200, 200] };
    triggerResize();
    expect(probe.count()).toBe(5);
    // The only rect read on resize belongs to the row element itself.
    const receivers = vi.mocked(Element.prototype.getBoundingClientRect).mock.contexts;
    const itemReads = receivers.filter(
      (element) => String((element as HTMLElement | null)?.dataset?.testid ?? '').startsWith('item-'),
    );
    expect(itemReads).toHaveLength(0);
  });
});

describe('useOverflowCount — observes the row element', () => {
  it('observes the row element and disconnects on unmount', () => {
    rects = { rowLeft: 10, rowWidth: 150, moreWidth: 32, itemWidths: [32, 32, 32, 32, 32] };
    stubRects();
    const probe = renderProbe(5);
    expect(latestObserver().observe).toHaveBeenCalledWith(probe.row());
    probe.view.unmount();
    expect(latestObserver().disconnect).toHaveBeenCalled();
  });
});

describe('useOverflowCount — item set changes trigger re-measurement', () => {
  it('re-measures item edges when the item set changes', () => {
    rects = { rowLeft: 10, rowWidth: 90, moreWidth: 32, itemWidths: [32, 32, 32, 32, 32] };
    stubRects();
    const probe = renderProbe(5);
    // Stale edges 32..160 at 90: only 32 + 34 = 66 <= 90, so the count is 1.
    expect(probe.count()).toBe(1);
    // Narrower items arrive with a longer list: only a re-measure sees edges
    // 16..96, where 48 + 34 = 82 <= 90 < 64 + 34 = 98, giving 3.
    rects.itemWidths = [16, 16, 16, 16, 16, 16];
    probe.view.rerender(createElement(Probe, { itemCount: 6, pinned: [] }));
    expect(probe.count()).toBe(3);
  });
});

describe('useOverflowCount — no window width', () => {
  it('ignores window resize events', () => {
    rects = { rowLeft: 10, rowWidth: 150, moreWidth: 32, itemWidths: [32, 32, 32, 32, 32] };
    stubRects();
    const probe = renderProbe(5);
    expect(probe.count()).toBe(3);
    // Even though the row's own measured width changed, no ResizeObserver
    // notification arrived, so the count must not move.
    rects.rowWidth = 100;
    fireEvent(window, new Event('resize'));
    expect(probe.count()).toBe(3);
  });
});
