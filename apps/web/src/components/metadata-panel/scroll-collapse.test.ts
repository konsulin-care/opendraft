import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import {
  COLLAPSE_PROGRESS_VAR,
  collapseReducer,
  computeCollapseProgress,
  createRafThrottle,
  INITIAL_COLLAPSE_STATE,
  useScrollCollapse,
  writeCollapseProgress,
  type CollapseAction,
} from './scroll-collapse';

// @vitest-environment jsdom

/** Expanded panel height used by the tests. */
const HEIGHT = 400;

/** DOM references handed to the hook under test. */
interface CollapseEnv {
  scroll: HTMLElement;
  panel: HTMLElement;
  scrollRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLElement | null>;
}
/** Pending animation frames recorded by the stubbed rAF. */
let pendingFrames: ((time: number) => void)[] = [];

/** Build detached scroll container and panel elements for one test. */
function makeEnv(): CollapseEnv {
  const scroll = document.createElement('div');
  const panel = document.createElement('div');
  scroll.appendChild(panel);
  document.body.appendChild(scroll);
  return {
    scroll,
    panel,
    scrollRef: { current: scroll },
    panelRef: { current: panel },
  };
}

/** Replace requestAnimationFrame with a queue tests flush manually. */
function stubRaf(): void {
  pendingFrames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: (time: number) => void) => {
    pendingFrames.push(cb);
    return pendingFrames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    pendingFrames[id - 1] = () => {};
  });
}

/** Run every queued animation frame inside act(). */
function flushFrames(): void {
  const frames = pendingFrames;
  pendingFrames = [];
  act(() => {
    for (const frame of frames) frame(0);
  });
}

/** Mock window.matchMedia so the reduced-motion query matches or not. */
function stubMotion(reduced: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: reduced && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }),
  });
}

/** Overwrite scrollTop (jsdom has no layout) and fire a scroll event. */
function setScrollTop(el: HTMLElement, value: number): void {
  Object.defineProperty(el, 'scrollTop', { configurable: true, value });
  fireEvent.scroll(el);
}

/** Build a scroll action against the test's expanded height. */
function scrollAction(
  scrollTop: number,
  extra: Partial<Extract<CollapseAction, { type: 'scroll' }>> = {},
): CollapseAction {
  return { type: 'scroll', scrollTop, expandedHeight: HEIGHT, ...extra };
}

beforeEach(() => {
  stubRaf();
  stubMotion(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('computeCollapseProgress', () => {
  it('returns 0 at the top and 1 once fully scrolled', () => {
    expect(computeCollapseProgress(0, HEIGHT)).toBe(0);
    expect(computeCollapseProgress(HEIGHT, HEIGHT)).toBe(1);
    expect(computeCollapseProgress(HEIGHT * 2, HEIGHT)).toBe(1);
  });

  it('interpolates between the endpoints', () => {
    expect(computeCollapseProgress(HEIGHT / 2, HEIGHT)).toBe(0.5);
  });

  it('clamps negative offsets and handles empty heights', () => {
    expect(computeCollapseProgress(-20, HEIGHT)).toBe(0);
    expect(computeCollapseProgress(0, 0)).toBe(0);
    expect(computeCollapseProgress(1, 0)).toBe(1);
  });
});

describe('collapseReducer: explicit collapse', () => {
  it('collapses, stays collapsed when scrolling to the top, expands again', () => {
    const collapsed = collapseReducer(INITIAL_COLLAPSE_STATE, { type: 'explicitCollapse' });
    expect(collapsed).toEqual({ mode: 'explicit', progress: 0 });
    expect(collapseReducer(collapsed, scrollAction(0))).toEqual({ mode: 'explicit', progress: 0 });
    expect(collapseReducer(collapsed, { type: 'explicitExpand' })).toEqual({ mode: 'expanded', progress: 0 });
  });
});

describe('collapseReducer: scroll collapse', () => {
  it('interpolates progress below full collapse', () => {
    expect(collapseReducer(INITIAL_COLLAPSE_STATE, scrollAction(HEIGHT / 2))).toEqual({ mode: 'expanded', progress: 0.5 });
  });

  it('enters scroll mode once fully collapsed', () => {
    const collapsed = collapseReducer(INITIAL_COLLAPSE_STATE, scrollAction(HEIGHT));
    expect(collapsed).toEqual({ mode: 'scroll', progress: 1 });
  });
  it('re-expands when scrolling back to the top', () => {
    const collapsed = collapseReducer(INITIAL_COLLAPSE_STATE, scrollAction(HEIGHT));
    expect(collapseReducer(collapsed, scrollAction(0)))
      .toEqual({ mode: 'expanded', progress: 0 });
  });

  it('returns the same state object when mode and progress are unchanged', () => {
    const partial = collapseReducer(INITIAL_COLLAPSE_STATE, scrollAction(HEIGHT / 2));
    expect(collapseReducer(partial, scrollAction(HEIGHT / 2))).toBe(partial);
  });

  it('returns a new object when progress or mode changes', () => {
    const partial = collapseReducer(INITIAL_COLLAPSE_STATE, scrollAction(HEIGHT / 2));
    expect(collapseReducer(partial, scrollAction(HEIGHT / 4))).not.toBe(partial);
    const full = collapseReducer(INITIAL_COLLAPSE_STATE, scrollAction(HEIGHT));
    expect(collapseReducer(full, scrollAction(0))).not.toBe(full);
  });
});

describe('collapseReducer: focus freeze and reduced motion', () => {
  it('leaves progress unchanged while a field in the panel has focus', () => {
    const partial = collapseReducer(INITIAL_COLLAPSE_STATE, scrollAction(HEIGHT / 2));
    expect(collapseReducer(partial, scrollAction(HEIGHT, { focusInPanel: true }))).toEqual(partial);
  });
  const reduced = (scrollTop: number) =>
    collapseReducer(INITIAL_COLLAPSE_STATE, scrollAction(scrollTop, { reducedMotion: true }));
  it('snaps values to only 0 or 1 under reduced motion', () => {
    for (const scrollTop of [0, 1, 100, 399, 400, 900]) {
      expect([0, 1]).toContain(reduced(scrollTop).progress);
    }
  });
  it('snaps to 1 only once fully collapsed', () => {
    expect(reduced(HEIGHT - 1).progress).toBe(0);
    expect(reduced(HEIGHT).progress).toBe(1);
  });
});

describe('createRafThrottle and writeCollapseProgress', () => {
  it('coalesces repeated schedules into one frame, runs again after it', () => {
    const callback = vi.fn();
    const throttle = createRafThrottle(callback);
    throttle.schedule();
    throttle.schedule();
    expect(pendingFrames.length).toBe(1);
    flushFrames();
    expect(callback).toHaveBeenCalledTimes(1);
    throttle.schedule();
    flushFrames();
    expect(callback).toHaveBeenCalledTimes(2);
  });
  it('drops a cancelled frame', () => {
    const callback = vi.fn();
    const throttle = createRafThrottle(callback);
    throttle.schedule();
    throttle.cancel();
    flushFrames();
    expect(callback).not.toHaveBeenCalled();
  });
  it('writes the progress to the CSS variable', () => {
    const el = document.createElement('div');
    writeCollapseProgress(el, 0.25);
    expect(el.style.getPropertyValue(COLLAPSE_PROGRESS_VAR)).toBe('0.25');
  });
  it('ignores a missing element', () => {
    expect(() => writeCollapseProgress(null, 0)).not.toThrow();
  });
});

/** Render {@link useScrollCollapse} against fresh DOM; drains first frame. */
function renderCollapse(enabled = true) {
  const env = makeEnv();
  const rendered = renderHook(() => useScrollCollapse({
    scrollRef: env.scrollRef,
    panelRef: env.panelRef,
    enabled,
    expandedHeight: () => HEIGHT,
  }));
  flushFrames();
  return { env, ...rendered };
}

describe('useScrollCollapse: scroll handling', () => {
  it('throttles scroll handling and writes progress to the CSS variable', () => {
    const { env, result } = renderCollapse();
    setScrollTop(env.scroll, 100);
    setScrollTop(env.scroll, 200);
    flushFrames();
    expect(result.current.state.progress).toBe(0.5);
    expect(env.panel.style.getPropertyValue(COLLAPSE_PROGRESS_VAR)).toBe('0.5');
  });

  it('collapses on scroll and re-expands at the top', () => {
    const { env, result } = renderCollapse();
    setScrollTop(env.scroll, HEIGHT);
    flushFrames();
    expect(result.current.state.mode).toBe('scroll');
    setScrollTop(env.scroll, 0);
    flushFrames();
    expect(result.current.state.mode).toBe('expanded');
    expect(result.current.state.progress).toBe(0);
  });

  it('ignores scrolling when disabled', () => {
    const { env, result } = renderCollapse(false);
    setScrollTop(env.scroll, HEIGHT);
    flushFrames();
    expect(result.current.state).toEqual({ mode: 'expanded', progress: 0 });
  });

  it('skips the state update when a scroll changes nothing', () => {
    const { env, result } = renderCollapse();
    const before = result.current;
    setScrollTop(env.scroll, 0);
    flushFrames();
    expect(result.current).toBe(before);
    setScrollTop(env.scroll, HEIGHT);
    flushFrames();
    expect(result.current).not.toBe(before);
  });
});

describe('useScrollCollapse: collapse modes', () => {
  it('keeps an explicit collapse while scrolling back to the top', () => {
    const { env, result } = renderCollapse();
    act(() => result.current.collapse());
    expect(result.current.state.mode).toBe('explicit');
    setScrollTop(env.scroll, 0);
    flushFrames();
    expect(result.current.state.mode).toBe('explicit');
    act(() => result.current.expand());
    expect(result.current.state).toEqual({ mode: 'expanded', progress: 0 });
  });

  it('freezes progress while a field inside the panel has focus', () => {
    const { env, result } = renderCollapse();
    const input = document.createElement('input');
    env.panel.appendChild(input);
    input.focus();
    setScrollTop(env.scroll, 200);
    flushFrames();
    expect(result.current.state.progress).toBe(0);
  });

  it('snaps progress to 0 or 1 under reduced motion', () => {
    stubMotion(true);
    const { env, result } = renderCollapse();
    setScrollTop(env.scroll, 200);
    flushFrames();
    expect(result.current.state.progress).toBe(0);
    setScrollTop(env.scroll, HEIGHT);
    flushFrames();
    expect(result.current.state.progress).toBe(1);
  });
});
