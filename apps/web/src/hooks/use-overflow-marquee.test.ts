import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { useOverflowMarquee } from './use-overflow-marquee';

/** Original `window.matchMedia` descriptor restored after each test. */
const originalMatchMedia = Object.getOwnPropertyDescriptor(
  window,
  'matchMedia',
);

/** Mock ResizeObserver recorded per test so re-measures can be triggered. */
class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();

  /**
   * Record the instance and keep the resize callback.
   *
   * @param callback - Callback invoked on resize notifications.
   */
  constructor(private readonly callback: ResizeObserverCallback) {
    MockResizeObserver.instances.push(this);
  }

  /** Fire the stored callback to simulate a resize notification. */
  trigger(): void {
    this.callback([], this as unknown as ResizeObserver);
  }
}

/**
 * Stub `window.matchMedia` so the reduced-motion query matches or not.
 *
 * @param reducedMotion - Whether `(prefers-reduced-motion: reduce)` matches.
 */
function stubMatchMedia(reducedMotion: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reducedMotion && query === '(prefers-reduced-motion: reduce)',
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
 * Stub the scroll metrics of an element.
 *
 * @param element - Element to stub.
 * @param scrollWidth - Value reported as `scrollWidth`.
 * @param clientWidth - Value reported as `clientWidth`.
 */
function stubOverflow(
  element: HTMLElement,
  scrollWidth: number,
  clientWidth: number,
): void {
  Object.defineProperty(element, 'scrollWidth', {
    value: scrollWidth,
    configurable: true,
  });
  Object.defineProperty(element, 'clientWidth', {
    value: clientWidth,
    configurable: true,
  });
}

/** Probe that attaches the hook to a focusable div exposing the flag. */
function Probe(): ReturnType<typeof createElement> {
  const { ref, marquee } = useOverflowMarquee<HTMLDivElement>();
  return createElement('div', {
    ref,
    'data-testid': 'probe',
    'data-marquee': String(marquee),
    tabIndex: 0,
  });
}

/** Render the probe and return helpers to read its state. */
function renderProbe(): {
  element: HTMLElement;
  marquee: () => boolean;
  triggerResize: () => void;
} {
  const view = render(createElement(Probe));
  const element = view.getByTestId('probe');
  const triggerResize = (): void => {
    const instance = MockResizeObserver.instances.at(-1);
    if (!instance) throw new Error('ResizeObserver was not constructed');
    act(() => instance.trigger());
  };
  return { element, marquee: () => element.dataset.marquee === 'true', triggerResize };
}

beforeEach(() => {
  MockResizeObserver.instances = [];
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  stubMatchMedia(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalMatchMedia) {
    Object.defineProperty(window, 'matchMedia', originalMatchMedia);
  }
});

describe('useOverflowMarquee', () => {
  it('is false when the text fits, even while hovered', () => {
    const { element, marquee, triggerResize } = renderProbe();
    stubOverflow(element, 100, 200);
    triggerResize();
    fireEvent.mouseEnter(element);
    expect(marquee()).toBe(false);
  });

  it('is true when the text overflows and the element is hovered', () => {
    const { element, marquee, triggerResize } = renderProbe();
    stubOverflow(element, 300, 200);
    triggerResize();
    expect(marquee()).toBe(false);
    fireEvent.mouseEnter(element);
    expect(marquee()).toBe(true);
  });

});

describe('useOverflowMarquee focus and re-measure', () => {
  it('is true when the text overflows and the element is focused', () => {
    const { element, marquee, triggerResize } = renderProbe();
    stubOverflow(element, 300, 200);
    triggerResize();
    fireEvent.focus(element);
    expect(marquee()).toBe(true);
  });

  it('is false again on mouse leave or blur', () => {
    const { element, marquee, triggerResize } = renderProbe();
    stubOverflow(element, 300, 200);
    triggerResize();
    fireEvent.mouseEnter(element);
    expect(marquee()).toBe(true);
    fireEvent.mouseLeave(element);
    expect(marquee()).toBe(false);
    fireEvent.focus(element);
    expect(marquee()).toBe(true);
    fireEvent.blur(element);
    expect(marquee()).toBe(false);
  });

  it('is false when prefers-reduced-motion matches', () => {
    stubMatchMedia(true);
    const { element, marquee, triggerResize } = renderProbe();
    stubOverflow(element, 300, 200);
    triggerResize();
    fireEvent.mouseEnter(element);
    expect(marquee()).toBe(false);
  });

  it('re-measures the element when the ResizeObserver fires', () => {
    const { element, marquee, triggerResize } = renderProbe();
    stubOverflow(element, 100, 200);
    triggerResize();
    fireEvent.mouseEnter(element);
    expect(marquee()).toBe(false);
    stubOverflow(element, 300, 200);
    triggerResize();
    expect(marquee()).toBe(true);
  });
});
