import { describe, expect, it } from 'vitest';
import { normalizeShortName, uniqueShortName } from './slug';

describe('normalizeShortName', () => {
  it("normalizes 'Like This' to 'like-this'", () => {
    expect(normalizeShortName('Like This')).toBe('like-this');
  });

  it('strips accents and lowercases', () => {
    expect(normalizeShortName('Café RÉsumé')).toBe('cafe-resume');
  });

  it('collapses repeated hyphens and trims leading/trailing hyphens', () => {
    expect(normalizeShortName(' --a---  B-- ')).toBe('a-b');
  });

  it("returns 'section' when normalization yields an empty string", () => {
    expect(normalizeShortName('!!!')).toBe('section');
    expect(normalizeShortName('')).toBe('section');
    expect(normalizeShortName('---')).toBe('section');
  });

  it('caps the normalized short name at 40 characters', () => {
    // Lands exactly on 40 with no trailing hyphen.
    expect(normalizeShortName('abcdefghij '.repeat(5))).toHaveLength(40);
    // Lands on a hyphen at the cap: trimmed, still within 40.
    const capped = normalizeShortName('word '.repeat(20));
    expect(capped.length).toBeLessThanOrEqual(40);
    expect(capped.endsWith('-')).toBe(false);
  });
});

describe('uniqueShortName', () => {
  it('returns the normalized title when the candidate is free', () => {
    expect(uniqueShortName('Like This', () => false)).toBe('like-this');
  });

  it('appends a 6-char lowercase ULID suffix to a taken candidate', () => {
    const result = uniqueShortName('Like This', (name) => name === 'like-this');
    expect(result).toMatch(/^like-this-[0-9abcdefghjkmnpqrstuvwxyz]{6}$/);
    expect(result.length).toBeLessThanOrEqual(40);
  });

  it('truncates the title part so the total stays within 40 characters', () => {
    const taken = normalizeShortName('abcdefghij '.repeat(5));
    const result = uniqueShortName(
      'abcdefghij '.repeat(5),
      (name) => name === taken,
      () => 'abcdef',
    );
    expect(result).toBe('abcdefghij-abcdefghij-abcdefghij-abcdef');
    expect(result.length).toBeLessThanOrEqual(40);
  });

  it('regenerates the suffix when the suffixed candidate collides again', () => {
    const suffixes = ['aaaaaa', 'bbbbbb'];
    let index = 0;
    const nextSuffix = (): string => suffixes[index++] ?? 'cccccc';
    const used = new Set(['like-this', 'like-this-aaaaaa']);
    const result = uniqueShortName('Like This', (name) => used.has(name), nextSuffix);
    expect(result).toBe('like-this-bbbbbb');
    expect(index).toBe(2);
  });
});
