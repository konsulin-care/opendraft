import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCROLL_IDLE_MS, installScrollbarAutoHide } from './scrollbar-auto-hide.js';

/** Dispatch a non-bubbling scroll event on the given target, like real scrolling. */
function scroll(target: EventTarget): void {
  target.dispatchEvent(new Event('scroll'));
}

let dispose: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.useRealTimers();
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-scrolling');
});

describe('scrollbar auto-hide — idle timeout', () => {
  it('uses an 800ms idle timeout', () => {
    expect(SCROLL_IDLE_MS).toBe(800);
  });

  it('marks a scrolled element and clears it 800ms after the last scroll', () => {
    dispose = installScrollbarAutoHide(document);
    const scroller = document.createElement('div');
    document.body.appendChild(scroller);

    scroll(scroller);
    expect(scroller.hasAttribute('data-scrolling')).toBe(true);

    vi.advanceTimersByTime(500);
    scroll(scroller);
    vi.advanceTimersByTime(799);
    expect(scroller.hasAttribute('data-scrolling')).toBe(true);

    vi.advanceTimersByTime(1);
    expect(scroller.hasAttribute('data-scrolling')).toBe(false);
  });

  it('marks the document element when the page itself scrolls', () => {
    dispose = installScrollbarAutoHide(document);

    scroll(document);
    expect(document.documentElement.hasAttribute('data-scrolling')).toBe(true);

    vi.advanceTimersByTime(SCROLL_IDLE_MS);
    expect(document.documentElement.hasAttribute('data-scrolling')).toBe(false);
  });
});

describe('scrollbar auto-hide — per-element timers', () => {
  it('clears each scroll container independently', () => {
    dispose = installScrollbarAutoHide(document);
    const first = document.createElement('div');
    const second = document.createElement('div');
    document.body.append(first, second);

    scroll(first);
    vi.advanceTimersByTime(400);
    scroll(second);

    vi.advanceTimersByTime(400);
    expect(first.hasAttribute('data-scrolling')).toBe(false);
    expect(second.hasAttribute('data-scrolling')).toBe(true);

    vi.advanceTimersByTime(400);
    expect(second.hasAttribute('data-scrolling')).toBe(false);
  });
});
