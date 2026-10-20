import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/** Media query string for the user's reduced-motion preference. */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Value returned by {@link useOverflowMarquee}. */
export interface OverflowMarquee<T extends HTMLElement> {
  /** Attach to the text element whose overflow is tracked. */
  ref: RefObject<T | null>;
  /** True while the element overflows, is hovered or focused, and motion is allowed. */
  marquee: boolean;
}

/**
 * Track whether an element's text overflows horizontally and should scroll.
 *
 * The element is measured on mount and re-measured whenever a
 * `ResizeObserver` reports a size change; overflow means `scrollWidth` is
 * greater than `clientWidth`. Hovering or focusing the element engages the
 * marquee, and leaving or blurring it releases it. When the user prefers
 * reduced motion, the flag stays false regardless of overflow.
 *
 * @typeParam T - The HTMLElement type of the tracked element.
 * @returns A ref for the element and the current marquee flag.
 */
export function useOverflowMarquee<T extends HTMLElement>(): OverflowMarquee<T> {
  const ref = useRef<T | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return undefined;
    }
    const measure = (): void => {
      setOverflowing(element.scrollWidth > element.clientWidth);
    };
    measure();
    // Without ResizeObserver support the element is measured once on mount.
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    const onEngage = (): void => setEngaged(true);
    const onRelease = (): void => setEngaged(false);
    element.addEventListener('mouseenter', onEngage);
    element.addEventListener('mouseleave', onRelease);
    element.addEventListener('focus', onEngage);
    element.addEventListener('blur', onRelease);
    return () => {
      observer?.disconnect();
      element.removeEventListener('mouseenter', onEngage);
      element.removeEventListener('mouseleave', onRelease);
      element.removeEventListener('focus', onEngage);
      element.removeEventListener('blur', onRelease);
    };
  }, []);

  useEffect(() => {
    const query = window.matchMedia?.(REDUCED_MOTION_QUERY);
    if (!query) {
      return undefined;
    }
    const onChange = (event: MediaQueryListEvent): void => {
      setReducedMotion(event.matches);
    };
    setReducedMotion(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return { ref, marquee: overflowing && engaged && !reducedMotion };
}
