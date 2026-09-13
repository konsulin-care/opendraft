// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { PLACEHOLDER_HINTS, pickPlaceholderHint } from './placeholder';

/** Deterministic LCG returning values in [0, 1). */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

describe('placeholder hints', () => {
  it('exposes exactly five distinct uplifting hints', () => {
    expect(PLACEHOLDER_HINTS).toHaveLength(5);
    expect(new Set(PLACEHOLDER_HINTS).size).toBe(5);
  });

  it('picks a hint that is a member of the hint list', () => {
    for (const seed of [1, 2, 42, 1337, 9999]) {
      const hint = pickPlaceholderHint(seededRandom(seed));
      expect(PLACEHOLDER_HINTS).toContain(hint);
      expect(hint.length).toBeGreaterThan(10);
    }
  });

  it('is deterministic for a fixed random source', () => {
    expect(pickPlaceholderHint(seededRandom(42))).toBe(pickPlaceholderHint(seededRandom(42)));
  });
});