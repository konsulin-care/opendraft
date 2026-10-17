import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Preserves the scroll position of the editor's scroll container when focus
 * leaves the editing surface.
 *
 * Clicking a table and then clicking elsewhere can make the browser scroll the
 * newly-focused element into view, jumping the viewport even though the
 * document itself did not move. Focus moves that stay inside the container
 * (e.g. table cell to table cell) are left alone so legitimate
 * scroll-into-view behaviour keeps working.
 *
 * @param containerRef - Ref to the scrollable container to guard.
 * @returns void
 */
export function useFocusScrollGuard(containerRef: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleFocusOut = (event: FocusEvent): void => {
      const next = event.relatedTarget;
      if (next instanceof Node && container.contains(next)) return;
      const savedTop = container.scrollTop;
      const restore = (): void => {
        if (container.scrollTop !== savedTop) container.scrollTop = savedTop;
      };
      // The browser applies its focus scroll after focusout listeners run,
      // so restore both immediately and on the next frame.
      restore();
      requestAnimationFrame(restore);
    };
    container.addEventListener('focusout', handleFocusOut);
    return () => container.removeEventListener('focusout', handleFocusOut);
  }, [containerRef]);
}
