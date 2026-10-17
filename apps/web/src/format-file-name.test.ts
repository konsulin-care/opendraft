import { describe, expect, it } from 'vitest';
import { formatFileName } from './format-file-name';

/** Repeat a character `count` times. */
function repeat(char: string, count: number): string {
  return char.repeat(count);
}

describe('formatFileName', () => {
  it('returns names at or below the max unchanged', () => {
    expect(formatFileName('manuscript.md')).toBe('manuscript.md');
    expect(formatFileName('')).toBe('');
    expect(formatFileName(repeat('a', 140))).toBe(repeat('a', 140));
    expect(formatFileName(repeat('a', 139))).toBe(repeat('a', 139));
  });

  it('caps a 200-char name to ellipsis plus the last 139 code points', () => {
    const name = repeat('a', 200);
    const result = formatFileName(name);
    expect(result).toBe(`…${repeat('a', 139)}`);
    expect(Array.from(result)).toHaveLength(140);
  });

  it('defaults max to 140 code points', () => {
    const name = repeat('b', 141);
    const result = formatFileName(name);
    expect(Array.from(result)).toHaveLength(140);
    expect(result.startsWith('…')).toBe(true);
    expect(result.endsWith(repeat('b', 139))).toBe(true);
  });

  it('supports a custom max', () => {
    expect(formatFileName(repeat('c', 11), 10)).toBe(`…${repeat('c', 9)}`);
    expect(formatFileName(repeat('c', 10), 10)).toBe(repeat('c', 10));
  });

  it('never splits multi-code-unit characters', () => {
    // Each emoji is one code point but two UTF-16 code units.
    const emojiName = repeat('😀', 200);
    const result = formatFileName(emojiName);
    expect(Array.from(result)).toHaveLength(140);
    expect(result).toBe(`…${repeat('😀', 139)}`);
    // Equivalent to slicing the raw string by code units would break surrogates;
    // the code-point result must match the whole-emoji tail exactly.
    expect(result).toBe(`…${emojiName.slice(-139 * 2)}`);
  });

  it('handles accented characters by code point', () => {
    // é (U+00E9): exactly at max is unchanged, one over is capped by code points.
    expect(formatFileName(repeat('é', 140))).toBe(repeat('é', 140));
    expect(formatFileName(repeat('é', 141))).toBe(`…${repeat('é', 139)}`);
    // Astral-plane accented glyph (2 UTF-16 code units, 1 code point) is never split.
    const astralName = repeat('\u{1D400}', 150); // mathematical bold A
    const result = formatFileName(astralName);
    expect(Array.from(result)).toHaveLength(140);
    expect(result).toBe(`…${astralName.slice(-139 * 2)}`);
  });
});
