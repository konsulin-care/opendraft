import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVirtualKeyboard } from './useVirtualKeyboard';

/** Baseline window height used by the tests. */
const INNER_HEIGHT = 800;

/** Original property descriptors restored after each test. */
const originalDescriptors: Record<string, PropertyDescriptor | undefined> = {
  innerHeight: Object.getOwnPropertyDescriptor(window, 'innerHeight'),
  visualViewport: Object.getOwnPropertyDescriptor(window, 'visualViewport'),
  matchMedia: Object.getOwnPropertyDescriptor(window, 'matchMedia'),
};

/**
 * Stub `window.matchMedia` so `(pointer: coarse)` matches or not.
 *
 * @param coarse - Whether the pointer should be reported as coarse.
 */
function stubMatchMedia(coarse: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: coarse && query === '(pointer: coarse)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

/**
 * Stub `window.visualViewport` with a controllable height and a resize
 * dispatcher.
 *
 * @param height - Initial viewport height in px.
 * @returns Controls to change the height and fire a resize event.
 */
function stubVisualViewport(height: number): {
  setHeight: (next: number) => void;
  fireResize: () => void;
} {
  let currentHeight = height;
  const listeners = new Set<() => void>();
  const viewport = {
    get height(): number {
      return currentHeight;
    },
    width: 390,
    offsetTop: 0,
    offsetLeft: 0,
    scale: 1,
    addEventListener: (type: string, listener: () => void): void => {
      if (type === 'resize') listeners.add(listener);
    },
    removeEventListener: (type: string, listener: () => void): void => {
      listeners.delete(listener);
    },
  };
  Object.defineProperty(window, 'visualViewport', {
    value: viewport,
    configurable: true,
  });
  return {
    setHeight: (next: number) => {
      currentHeight = next;
    },
    fireResize: () => listeners.forEach((listener) => listener()),
  };
}

/** Stub `window.innerHeight` to a fixed value. */
function stubInnerHeight(value: number): void {
  Object.defineProperty(window, 'innerHeight', {
    value,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const [key, descriptor] of Object.entries(originalDescriptors)) {
    if (descriptor) {
      Object.defineProperty(window, key, descriptor);
    } else {
      Reflect.deleteProperty(window, key);
    }
  }
});

describe('useVirtualKeyboard', () => {
  it('reports an open keyboard on a coarse-pointer device when the viewport is more than 150px shorter than the window', () => {
    stubInnerHeight(INNER_HEIGHT);
    stubMatchMedia(true);
    stubVisualViewport(INNER_HEIGHT - 500);

    const { result } = renderHook(() => useVirtualKeyboard());

    expect(result.current.open).toBe(true);
    expect(result.current.bottomOffset).toBe(500);
  });

  it('reports a closed keyboard with a fine pointer even when the viewport shrinks', () => {
    stubInnerHeight(INNER_HEIGHT);
    stubMatchMedia(false);
    stubVisualViewport(INNER_HEIGHT - 500);

    const { result } = renderHook(() => useVirtualKeyboard());

    expect(result.current.open).toBe(false);
  });

  it('reports a closed keyboard when the viewport height equals the window height', () => {
    stubInnerHeight(INNER_HEIGHT);
    stubMatchMedia(true);
    stubVisualViewport(INNER_HEIGHT);

    const { result } = renderHook(() => useVirtualKeyboard());

    expect(result.current.open).toBe(false);
    expect(result.current.bottomOffset).toBe(0);
  });

  it('updates the returned values on a visualViewport resize event', () => {
    stubInnerHeight(INNER_HEIGHT);
    stubMatchMedia(true);
    const viewport = stubVisualViewport(INNER_HEIGHT);

    const { result } = renderHook(() => useVirtualKeyboard());
    expect(result.current.open).toBe(false);

    act(() => {
      viewport.setHeight(INNER_HEIGHT - 300);
      viewport.fireResize();
    });

    expect(result.current.open).toBe(true);
    expect(result.current.bottomOffset).toBe(300);
  });
});
