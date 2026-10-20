import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import { useOverflowCount } from './use-overflow-count';
import type { UseOverflowCountOptions } from './use-overflow-count';

/** Mock ResizeObserver recorded per test so re-measures can be triggered. */
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

/** Widths served by the `getBoundingClientRect` stub, keyed by testid. */
interface WidthConfig {
  row: number;
  more: number;
  items: number[];
}

/**
 * Width reported for an item element by its `item-<index>` testid.
 *
 * @param testid - `data-testid` of the measured element.
 * @param config - Width configuration of the current test.
 * @returns The configured item width, or 0 for unknown elements.
 */
function itemWidth(testid: string, config: WidthConfig): number {
  if (!testid.startsWith('item-')) return 0;
  return config.items[Number(testid.slice('item-'.length))] ?? 0;
}

/**
 * Stub element widths: the row, the More trigger, and each item are served
 * from `config` lazily, so tests can mutate the config and re-trigger the
 * observer to simulate resizes.
 *
 * @param config - Width configuration read on every measurement.
 */
function stubWidths(config: WidthConfig): void {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element,
  ) {
    const testid = (this as HTMLElement).dataset?.testid ?? '';
    const width =
      testid === 'row' ? config.row : testid === 'more' ? config.more : itemWidth(testid, config);
    return {
      width,
      height: 0,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 0,
      right: width,
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

describe('useOverflowCount — row width drives the count', () => {
  it('reduces the visible count when the observed row width shrinks', () => {
    const config: WidthConfig = { row: 150, more: 32, items: [32, 32, 32, 32, 32] };
    stubWidths(config);
    const probe = renderProbe(5);
    // 5 items at 32, gap 2, More 32: costWithMore(3) = 134 <= 150 < 168 (all fit).
    expect(probe.count()).toBe(3);
    config.row = 100;
    triggerResize();
    expect(probe.count()).toBe(2);
  });

  it('increases the visible count when the observed row width grows', () => {
    const config: WidthConfig = { row: 100, more: 32, items: [32, 32, 32, 32, 32] };
    stubWidths(config);
    const probe = renderProbe(5);
    expect(probe.count()).toBe(2);
    config.row = 400;
    triggerResize();
    expect(probe.count()).toBe(5);
  });

  it('observes the row element and disconnects on unmount', () => {
    const config: WidthConfig = { row: 150, more: 32, items: [32, 32, 32, 32, 32] };
    stubWidths(config);
    const probe = renderProbe(5);
    expect(latestObserver().observe).toHaveBeenCalledWith(probe.row());
    probe.view.unmount();
    expect(latestObserver().disconnect).toHaveBeenCalled();
  });
});

describe('useOverflowCount — item set changes trigger re-measurement', () => {
  it('re-measures item widths when the item set changes', () => {
    const config: WidthConfig = { row: 100, more: 32, items: [32, 32, 32, 32, 32] };
    stubWidths(config);
    const probe = renderProbe(5);
    expect(probe.count()).toBe(2);
    // Narrower items arrive with a longer list: only a re-measure sees them.
    config.items = [16, 16, 16, 16, 16, 16];
    probe.view.rerender(createElement(Probe, { itemCount: 6, pinned: [] }));
    // 6 items at 16: costWithMore(3) = 86 <= 100 < 104; stale widths give 2.
    expect(probe.count()).toBe(3);
  });

  it('does not re-measure item widths on resize or plain re-render', () => {
    const config: WidthConfig = { row: 100, more: 32, items: [32, 32, 32, 32, 32] };
    stubWidths(config);
    const probe = renderProbe(5);
    config.items = [16, 16, 16, 16, 16, 16];
    probe.view.rerender(createElement(Probe, { itemCount: 6, pinned: [] }));
    expect(probe.count()).toBe(3);
    // Items shrink again, but the item set is unchanged, so the hook keeps
    // the widths measured at the last item-set change.
    config.items = [8, 8, 8, 8, 8, 8];
    probe.view.rerender(createElement(Probe, { itemCount: 6, pinned: [] }));
    triggerResize();
    expect(probe.count()).toBe(3);
  });
});

describe('useOverflowCount — no window width', () => {
  it('ignores window resize events', () => {
    const config: WidthConfig = { row: 150, more: 32, items: [32, 32, 32, 32, 32] };
    stubWidths(config);
    const probe = renderProbe(5);
    expect(probe.count()).toBe(3);
    // Even though the row's own measured width changed, no ResizeObserver
    // notification arrived, so the count must not move.
    config.row = 100;
    fireEvent(window, new Event('resize'));
    expect(probe.count()).toBe(3);
  });
});
