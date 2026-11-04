import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import { useLazyMount } from './use-lazy-mount';

/**
 * Stand-in IntersectionObserver recording instances so tests can drive
 * viewport intersections manually; jsdom provides no native observer.
 */
class FakeIntersectionObserver implements IntersectionObserver {
  /** Every instance constructed since the last reset. */
  static instances: FakeIntersectionObserver[] = [];

  /** Clear the recorded instance list between tests. */
  static reset(): void {
    FakeIntersectionObserver.instances = [];
  }

  readonly root: Element | Document | null = null;
  readonly rootMargin = '0px';
  readonly scrollMargin = '0px';
  readonly thresholds: ReadonlyArray<number> = [0];
  private readonly callback: IntersectionObserverCallback;
  private readonly targets: Element[] = [];

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }

  /**
   * Fire the observed callback with the given intersection state.
   *
   * @param isIntersecting - Whether the observed element is in the viewport.
   */
  intersect(isIntersecting: boolean): void {
    const target = this.targets[0];
    if (target === undefined) return;
    const entry = { target, isIntersecting } as IntersectionObserverEntry;
    this.callback([entry], this);
  }

  observe(target: Element): void {
    this.targets.push(target);
  }

  unobserve(target: Element): void {
    const index = this.targets.indexOf(target);
    if (index >= 0) this.targets.splice(index, 1);
  }

  disconnect(): void {
    this.targets.length = 0;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

beforeEach(() => {
  FakeIntersectionObserver.reset();
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Build a ref holding a fresh detached block element.
 *
 * @returns A stable ref usable as the hook's element ref.
 */
function blockRef(): RefObject<HTMLDivElement> {
  return { current: document.createElement('div') };
}

describe('useLazyMount', () => {
  it('reports not mounted while the block is collapsed', () => {
    const ref = blockRef();
    const { result } = renderHook(() => useLazyMount(ref, false));

    act(() => FakeIntersectionObserver.instances[0].intersect(true));

    expect(result.current).toBe(false);
  });

  it('mounts when an expanded block intersects the viewport', () => {
    const ref = blockRef();
    const { result } = renderHook(() => useLazyMount(ref, true));

    expect(result.current).toBe(false);

    act(() => FakeIntersectionObserver.instances[0].intersect(true));

    expect(result.current).toBe(true);
  });

  it('keeps the editor mounted after the block scrolls out of the viewport', () => {
    const ref = blockRef();
    const { result } = renderHook(() => useLazyMount(ref, true));

    act(() => FakeIntersectionObserver.instances[0].intersect(true));
    expect(result.current).toBe(true);

    act(() => FakeIntersectionObserver.instances[0].intersect(false));
    expect(result.current).toBe(true);
  });
});
