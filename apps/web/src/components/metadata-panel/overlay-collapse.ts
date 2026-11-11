/**
 * Scroll-driven collapse for the overlay state of the manuscript
 * metadata panel. When the panel covers the editor area as an overlay
 * with its own vertical scroll, the overlay's scroll offset — measured
 * against the expanded body height — drives the collapse progress
 * written to the panel's `--collapse-progress` CSS variable, so the
 * pinned bar title/byline fade in. Once the body is fully scrolled out
 * the panel collapses through a session-only callback that never
 * touches localStorage.
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { computeCollapseProgress, createRafThrottle, writeCollapseProgress } from './scroll-collapse';

/** Options for {@link useOverlayCollapse}. */
export interface OverlayCollapseOptions {
  /** Overlay scroll layer observed for scroll events. */
  overlayRef: RefObject<HTMLElement | null>;
  /** Panel element receiving the collapse-progress CSS variable. */
  panelRef: RefObject<HTMLElement | null>;
  /** Whether the overlay currently owns the scrolling (hook active). */
  enabled: boolean;
  /** Height of the expanded body the overlay scroll is measured against. */
  expandedHeight: () => number;
  /** Session-only callback fired when the scroll hides the expanded body. */
  onScrolledOut: () => void;
}

/** Control surface returned by {@link useOverlayCollapse}. */
export interface OverlayCollapseApi {
  /** Collapse progress in the 0..1 range driven by the overlay scroll. */
  progress: number;
}

/**
 * Drive the panel's collapse progress from the overlay scroller. Scroll
 * events are throttled through requestAnimationFrame, folded into a
 * 0..1 progress against the expanded body height and written to the
 * panel's `--collapse-progress` CSS variable. When the body is fully
 * scrolled out (progress reaches 1) the `onScrolledOut` callback fires
 * exactly once per activation; the overlay's current offset re-seeds
 * progress every time the overlay takes over again.
 *
 * @param options - See {@link OverlayCollapseOptions}.
 * @returns The current overlay-driven collapse progress.
 */
export function useOverlayCollapse(options: OverlayCollapseOptions): OverlayCollapseApi {
  const { overlayRef, panelRef, enabled, expandedHeight, onScrolledOut } = options;
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const heightRef = useRef(expandedHeight);
  heightRef.current = expandedHeight;
  const outRef = useRef(onScrolledOut);
  outRef.current = onScrolledOut;

  useEffect(() => {
    const scroller = overlayRef.current;
    const panel = panelRef.current;
    if (!enabled || !scroller || !panel) return undefined;
    /** Fold a scroll offset into progress state, the CSS variable and the callback. */
    const apply = (scrollTop: number, force = false): void => {
      const next = computeCollapseProgress(scrollTop, heightRef.current());
      if (!force && next === progressRef.current) return;
      progressRef.current = next;
      setProgress(next);
      writeCollapseProgress(panel, next);
      if (next >= 1) outRef.current();
    };
    // Seed from the overlay's current offset so a variable or progress
    // left over from a previous layout cannot leak into the fresh overlay.
    apply(scroller.scrollTop, true);
    const throttle = createRafThrottle(() => apply(scroller.scrollTop));
    const onScroll = (): void => throttle.schedule();
    scroller.addEventListener('scroll', onScroll);
    throttle.schedule();
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      throttle.cancel();
    };
  }, [enabled, overlayRef, panelRef]);

  return { progress };
}
