import { describe, it, expect } from 'vitest';
import { computeFitCount } from './fit-count';
import type { FitCountInput } from './fit-count';

/**
 * Measured right edges from the contract: five 32px items measured from the
 * row content start, so the cumulative right edges are 32, 64, 96, 128, 160
 * (each already includes its divider and the group gaps). Gap 2 and a 32px
 * More trigger. Note: the behavior text pairs content width 200 with the
 * count 3, but at 200 the last edge (160) fits, so the model returns the
 * full count with no More slot; the "largest count" case needs width 150
 * (96 + 2 + 32 = 130 <= 150 < 128 + 2 + 32 = 162). Both are covered below.
 */
const EDGES = [32, 64, 96, 128, 160];
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
    edges: EDGES,
    pinned: [false, false, false, false, false],
    contentWidth: 150,
    moreWidth: MORE_WIDTH,
    gap: GAP,
    ...overrides,
  });
}

describe('computeFitCount — all items fit, no More slot', () => {
  it('returns the full count at content width 400 with no More slot', () => {
    expect(fit({ contentWidth: 400 })).toBe(5);
  });

  it('returns the full count at content width 200 because the last edge (160) fits', () => {
    expect(fit({ contentWidth: 200 })).toBe(5);
  });
});

describe('computeFitCount — reserved More slot', () => {
  it('returns the largest count whose edge leaves room for the gap and the More slot', () => {
    // 3 items: edge 96 + gap 2 + More 32 = 130 <= 150; 4 items: 128 + 34 = 162 > 150.
    expect(fit({ contentWidth: 150 })).toBe(3);
  });

  it('shrinks the visible count as the row narrows', () => {
    // 2 items: edge 64 + 34 = 98 <= 100; 3 items: 96 + 34 = 130 > 100.
    expect(fit({ contentWidth: 100 })).toBe(2);
  });
});

describe('computeFitCount — pinned items', () => {
  it('keeps a pinned item at index 4 in the prefix even when it overflows', () => {
    // Without pinning only 2 items fit at width 100; the pinned item forces 5.
    expect(fit({ pinned: [false, false, false, false, true], contentWidth: 100 })).toBe(5);
  });
});

describe('computeFitCount — edge cases', () => {
  it('returns 0 at content width 0 with nothing pinned', () => {
    expect(fit({ contentWidth: 0 })).toBe(0);
  });

  it('collapses everything into More when nothing fits and nothing is pinned', () => {
    expect(fit({ edges: [80, 160], pinned: [false, false], contentWidth: 40 })).toBe(0);
  });

  it('returns 0 for an empty item list', () => {
    expect(fit({ edges: [], pinned: [] })).toBe(0);
  });
});
