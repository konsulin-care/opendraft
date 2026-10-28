// @vitest-environment jsdom
/**
 * useMediaQuery tests: matching the shared 640px and 1024px breakpoint
 * queries at simulated viewport widths, re-rendering on change, and the
 * exported query constants.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { NARROW_QUERY, WIDE_QUERY, useMediaQuery } from './use-media-query';

/** Original `window.matchMedia` descriptor restored after each test. */
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');

/** Simulated viewport width used by the stub. */
let viewportWidth = 1280;

/** Live stub query lists, re-evaluated when the viewport changes. */
interface StubMql {
  media: string;
  matches: boolean;
  listeners: Set<(event: MediaQueryListEvent) => void>;
}

const stubMqls: StubMql[] = [];

/**
 * Evaluate the shared breakpoint queries against a viewport width.
 *
 * @param media - Media query string.
 * @param width - Viewport width in pixels.
 * @returns Whether the query matches at that width.
 */
function queryMatches(media: string, width: number): boolean {
  const max = /\(max-width: (\d+)px\)/.exec(media);
  if (max) return width <= Number(max[1]);
  const min = /\(min-width: (\d+)px\)/.exec(media);
  return min ? width >= Number(min[1]) : false;
}

/** Install a width-aware `window.matchMedia` stub at 1280px. */
function stubMatchMedia(): void {
  viewportWidth = 1280;
  stubMqls.length = 0;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (media: string): MediaQueryList => {
      const entry: StubMql = {
        media,
        matches: queryMatches(media, viewportWidth),
        listeners: new Set(),
      };
      stubMqls.push(entry);
      return {
        media,
        get matches(): boolean { return entry.matches; },
        onchange: null,
        addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void): void => {
          entry.listeners.add(listener);
        },
        removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void): void => {
          entry.listeners.delete(listener);
        },
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      } as unknown as MediaQueryList;
    },
  });
}

/**
 * Change the simulated viewport width, firing change events on every
 * stub query list whose match flipped.
 *
 * @param width - New viewport width in pixels.
 */
function setViewport(width: number): void {
  viewportWidth = width;
  for (const entry of stubMqls) {
    const next = queryMatches(entry.media, width);
    if (next === entry.matches) continue;
    entry.matches = next;
    entry.listeners.forEach((listener) => listener({ matches: next } as MediaQueryListEvent));
  }
}

afterEach(() => {
  if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
});

describe('useMediaQuery breakpoints', () => {
  it('matches NARROW_QUERY below 640px only', () => {
    stubMatchMedia();
    setViewport(375);
    const narrow = renderHook(() => useMediaQuery(NARROW_QUERY));
    expect(narrow.result.current).toBe(true);
    narrow.unmount();
    setViewport(800);
    const mid = renderHook(() => useMediaQuery(NARROW_QUERY));
    expect(mid.result.current).toBe(false);
  });

  it('matches WIDE_QUERY at 1024px and above only', () => {
    stubMatchMedia();
    setViewport(1280);
    const wide = renderHook(() => useMediaQuery(WIDE_QUERY));
    expect(wide.result.current).toBe(true);
    wide.unmount();
    setViewport(800);
    const mid = renderHook(() => useMediaQuery(WIDE_QUERY));
    expect(mid.result.current).toBe(false);
  });

  it('re-renders when the viewport crosses the query', () => {
    stubMatchMedia();
    setViewport(800);
    const { result } = renderHook(() => useMediaQuery(NARROW_QUERY));
    expect(result.current).toBe(false);
    act(() => { setViewport(375); });
    expect(result.current).toBe(true);
  });

  it('exports the shared 640px and 1024px breakpoint queries', () => {
    expect(NARROW_QUERY).toBe('(max-width: 639px)');
    expect(WIDE_QUERY).toBe('(min-width: 1024px)');
  });
});
