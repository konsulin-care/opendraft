/**
 * Breakpoint constant tests: the pixel boundaries and the media-query strings
 * derived from them, kept in one place so the JS-side queries agree with the
 * Tailwind `sm`/`md`/`lg` scale.
 */
import { describe, expect, it } from 'vitest';
import { LG_PX, MD_PX, NARROW_QUERY, SM_PX, WIDE_QUERY } from './breakpoints';

describe('breakpoint boundaries', () => {
  it('exposes the sm, md and lg boundaries as 640, 768 and 1024 pixels', () => {
    expect(SM_PX).toBe(640);
    expect(MD_PX).toBe(768);
    expect(LG_PX).toBe(1024);
  });
});

describe('breakpoint queries', () => {
  it("is '(max-width: 767px)' so narrow means below md", () => {
    expect(NARROW_QUERY).toBe(`(max-width: ${MD_PX - 1}px)`);
    expect(NARROW_QUERY).toBe('(max-width: 767px)');
  });

  it("is '(min-width: 1024px)' so wide starts at lg", () => {
    expect(WIDE_QUERY).toBe(`(min-width: ${LG_PX}px)`);
    expect(WIDE_QUERY).toBe('(min-width: 1024px)');
  });
});
