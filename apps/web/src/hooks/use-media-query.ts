/**
 * Shared media-query hook for the responsive manuscript metadata UI.
 *
 * Tracks one CSS media query and re-renders when it changes. The
 * metadata panel, the authors dialog and the publication details grid
 * share the 640px (narrow/mobile) and 1024px (wide) breakpoints.
 */
import { useEffect, useState } from 'react';

/** Media query matching viewports below the 640px breakpoint. */
export const NARROW_QUERY = '(max-width: 639px)';

/** Media query matching viewports at or above the 1024px breakpoint. */
export const WIDE_QUERY = '(min-width: 1024px)';

/**
 * Track whether a CSS media query currently matches the viewport.
 *
 * @param query - Media query string, e.g. '(max-width: 639px)'.
 * @returns True while the query matches; false otherwise, including
 * when `window.matchMedia` is unavailable (SSR).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = (event: MediaQueryListEvent): void => setMatches(event.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
