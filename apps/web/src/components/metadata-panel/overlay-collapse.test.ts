import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import { COLLAPSE_PROGRESS_VAR } from './scroll-collapse';
import { useOverlayCollapse, type OverlayCollapseOptions } from './overlay-collapse';

// @vitest-environment jsdom

/** Expanded body height used by the tests. */
const HEIGHT = 400;

/** Pending animation frames recorded by the stubbed rAF. */
let pendingFrames: ((time: number) => void)[] = [];

/** DOM references handed to the hook under test. */
interface OverlayEnv {
  overlay: HTMLElement;
  panel: HTMLElement;
  overlayRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLElement | null>;
}

/** Build detached overlay scroller and panel elements for one test. */
function makeEnv(): OverlayEnv {
  const overlay = document.createElement('div');
  const panel = document.createElement('div');
  document.body.appendChild(overlay);
  document.body.appendChild(panel);
  return {
    overlay,
    panel,
    overlayRef: { current: overlay },
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

/** Overwrite scrollTop (jsdom has no layout) and fire a scroll event. */
function setScrollTop(el: HTMLElement, value: number): void {
  Object.defineProperty(el, 'scrollTop', { configurable: true, value });
  fireEvent.scroll(el);
}

/** Build the hook options for one render pass. */
function options(
  env: OverlayEnv,
  enabled: boolean,
  onScrolledOut: () => void,
): OverlayCollapseOptions {
  return {
    overlayRef: env.overlayRef,
    panelRef: env.panelRef,
    enabled,
    expandedHeight: () => HEIGHT,
    onScrolledOut,
  };
}

/** Render {@link useOverlayCollapse} against fresh DOM; drains first frame. */
function renderOverlay(enabled = true, onScrolledOut = vi.fn()) {
  const env = makeEnv();
  const rendered = renderHook(
    (props: OverlayCollapseOptions) => useOverlayCollapse(props),
    { initialProps: options(env, enabled, onScrolledOut) },
  );
  flushFrames();
  return { env, onScrolledOut, ...rendered };
}

beforeEach(() => {
  stubRaf();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('useOverlayCollapse', () => {
  it('seeds the collapse progress variable to 0 when the overlay activates', () => {
    const { env } = renderOverlay();
    expect(env.panel.style.getPropertyValue(COLLAPSE_PROGRESS_VAR)).toBe('0');
  });

  it('derives progress from the overlay scroll and writes the CSS variable', () => {
    const { env, result } = renderOverlay();
    setScrollTop(env.overlay, 100);
    setScrollTop(env.overlay, 200);
    flushFrames();
    expect(result.current.progress).toBe(0.5);
    expect(env.panel.style.getPropertyValue(COLLAPSE_PROGRESS_VAR)).toBe('0.5');
  });

  it('fires onScrolledOut once when the scroll fully hides the expanded body', () => {
    const { env, onScrolledOut, result } = renderOverlay();
    setScrollTop(env.overlay, HEIGHT);
    flushFrames();
    expect(result.current.progress).toBe(1);
    expect(onScrolledOut).toHaveBeenCalledTimes(1);
    fireEvent.scroll(env.overlay);
    flushFrames();
    expect(onScrolledOut).toHaveBeenCalledTimes(1);
  });

  it('ignores overlay scrolling while disabled', () => {
    const { env, onScrolledOut, result } = renderOverlay(false);
    setScrollTop(env.overlay, HEIGHT);
    flushFrames();
    expect(result.current.progress).toBe(0);
    expect(onScrolledOut).not.toHaveBeenCalled();
    expect(env.panel.style.getPropertyValue(COLLAPSE_PROGRESS_VAR)).toBe('');
  });

  it('re-seeds progress from the current offset when the overlay reactivates', () => {
    const { env, onScrolledOut, result, rerender } = renderOverlay();
    rerender(options(env, false, onScrolledOut));
    setScrollTop(env.overlay, 100);
    flushFrames();
    expect(result.current.progress).toBe(0);
    rerender(options(env, true, onScrolledOut));
    flushFrames();
    expect(result.current.progress).toBe(0.25);
    expect(env.panel.style.getPropertyValue(COLLAPSE_PROGRESS_VAR)).toBe('0.25');
    expect(onScrolledOut).not.toHaveBeenCalled();
  });
});
