/**
 * Shared media-query hook for the responsive manuscript UI.
 *
 * Tracks one CSS media query and re-renders when it changes. The metadata
 * panel, the authors dialog, the publication details grid and the header
 * panels share the boundaries from components/breakpoints.ts: narrow is up to
 * 767px (below the Tailwind `md` breakpoint) and wide starts at 1024px.
 */
import { useEffect, useState } from 'react';
import { NARROW_QUERY, WIDE_QUERY } from '../components/breakpoints';

export { NARROW_QUERY, WIDE_QUERY };

/**
 * Track whether a CSS media query currently matches the viewport.
 *
 * @param query - Media query string, e.g. NARROW_QUERY.
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
