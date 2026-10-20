import { describe, it, expect } from 'vitest';
import { computeFitCount } from './fit-count';
import type { FitCountInput } from './fit-count';

/**
 * Reference widths from the contract: [32, 32, 40, 32, 32] with gap 2 and a
 * 32px More trigger. Sum of items is 168; all items plus internal gaps cost
 * 168 + 4 * 2 = 176. Item 3 (40px) is the pinned Paragraph style trigger in
 * later tests.
 */
const WIDTHS = [32, 32, 40, 32, 32];
const GAP = 2;
const MORE_WIDTH = 32;

/**
 * Runs {@link computeFitCount} with the contract defaults, overriding only
 * the fields relevant to a case.
 *
 * @param overrides - Fields to override in the default input.
 * @returns The computed visible item count.
 */
function fit(overrides: Partial<FitCountInput>): number {
  return computeFitCount({
    widths: WIDTHS,
    pinned: [false, false, false, false, false],
    rowWidth: 200,
    moreWidth: MORE_WIDTH,
    gap: GAP,
    ...overrides,
  });
}

describe('computeFitCount — all items fit', () => {
  it('returns the full count with no More slot when all items fit at row width 400', () => {
    expect(fit({ rowWidth: 400 })).toBe(5);
  });

  it('returns the full count at row width 200 because all items fit without a More slot', () => {
    // 168 (items) + 8 (gaps) = 176 <= 200, so no More slot is reserved.
    expect(fit({ rowWidth: 200 })).toBe(WIDTHS.length);
  });
});

describe('computeFitCount — reserved More slot', () => {
  it('returns the largest prefix that fits together with the reserved More slot', () => {
    // Row 150 cannot hold all items (176 > 150), so the More slot is reserved:
    // 3 items cost 104 + 4 (gaps) + 2 (gap before More) + 32 (More) = 142 <= 150,
    // while 4 items would cost 136 + 6 + 2 + 32 = 176 > 150.
    expect(fit({ rowWidth: 150 })).toBe(3);
  });

  it('shrinks the visible prefix as the row narrows', () => {
    // Row 100: 2 items cost 64 + 2 + 2 + 32 = 100 <= 100; 3 items cost 142 > 100.
    expect(fit({ rowWidth: 100 })).toBe(2);
  });
});

describe('computeFitCount — pinned items', () => {
  it('returns at least 1 when the first item is pinned and wider than the row', () => {
    const count = fit({
      widths: [240, 32],
      pinned: [true, false],
      rowWidth: 100,
    });
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBe(1);
  });

  it('includes every pinned item in the visible prefix even when it exceeds the row', () => {
    // Without pinning, only 2 items fit at row 100; item index 2 is pinned, so
    // the prefix must extend to at least 3.
    expect(fit({ pinned: [false, false, true, false, false], rowWidth: 100 })).toBe(3);
  });
});

describe('computeFitCount — edge cases', () => {
  it('collapses everything into More when nothing fits and nothing is pinned', () => {
    expect(fit({ widths: [100, 100], pinned: [false, false], rowWidth: 40 })).toBe(0);
  });

  it('returns 0 for an empty item list', () => {
    expect(fit({ widths: [], pinned: [] })).toBe(0);
  });
});
