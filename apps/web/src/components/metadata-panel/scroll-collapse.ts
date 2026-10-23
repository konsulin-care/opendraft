/**
 * Scroll-driven collapse logic for the manuscript metadata panel.
 *
 * Progress is derived from the scroll offset relative to the expanded
 * panel height, throttled through requestAnimationFrame and written to
 * a CSS variable so the panel can shrink/fade its sections. Collapse
 * caused by scrolling reverses at the top; an explicit chevron collapse
 * stays collapsed. Progress freezes while a metadata field has focus
 * and snaps to 0 or 1 under prefers-reduced-motion.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/** CSS custom property carrying the 0..1 collapse progress. */
export const COLLAPSE_PROGRESS_VAR = '--collapse-progress';

/** Media query consulted for the reduced-motion preference. */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** How the panel ended up collapsed (or not at all). */
export type CollapseMode = 'expanded' | 'scroll' | 'explicit';

/** Collapse state: the collapse origin plus the 0..1 progress. */
export interface CollapseState {
  /** Where the current collapse came from. */
  mode: CollapseMode;
  /** Collapse progress in the 0..1 range. */
  progress: number;
}

/** Initial state: expanded with no progress. */
export const INITIAL_COLLAPSE_STATE: CollapseState = { mode: 'expanded', progress: 0 };

/** Actions accepted by {@link collapseReducer}. */
export type CollapseAction =
  | {
      /** Scroll update from the editor scroll container. */
      type: 'scroll';
      /** Current scrollTop of the scroll container. */
      scrollTop: number;
      /** Height of the expandable panel region. */
      expandedHeight: number;
      /** True while a metadata field inside the panel has focus. */
      focusInPanel?: boolean;
      /** True when the user prefers reduced motion. */
      reducedMotion?: boolean;
    }
  | { /** Chevron collapse; not reversed by scrolling to the top. */ type: 'explicitCollapse' }
  | { /** Chevron expand. */ type: 'explicitExpand' };

/**
 * Compute the collapse progress for a scroll offset.
 *
 * @param scrollTop - Current scroll offset of the scroll container.
 * @param expandedHeight - Height of the expandable panel region.
 * @returns Progress in 0..1, clamped at both ends.
 */
export function computeCollapseProgress(scrollTop: number, expandedHeight: number): number {
  if (expandedHeight <= 0) return scrollTop > 0 ? 1 : 0;
  const raw = scrollTop / expandedHeight;
  if (Number.isNaN(raw)) return 0;
  return Math.min(1, Math.max(0, raw));
}

/**
 * Snap a progress value to an endpoint when reduced motion is preferred.
 *
 * @param progress - Interpolated progress in 0..1.
 * @param reducedMotion - Whether the user prefers reduced motion.
 * @returns 0 or 1 under reduced motion, otherwise the input value.
 */
function snapProgress(progress: number, reducedMotion: boolean): number {
  if (!reducedMotion) return progress;
  return progress >= 1 ? 1 : 0;
}

/**
 * Fold a collapse action into the current collapse state.
 *
 * Scroll updates are no-ops while a metadata field has focus and while
 * the panel is explicitly collapsed; scroll-induced collapse reverses
 * when the container reaches the top.
 *
 * @param state - Current collapse state.
 * @param action - Action to apply.
 * @returns The next collapse state.
 */
export function collapseReducer(state: CollapseState, action: CollapseAction): CollapseState {
  if (action.type === 'explicitCollapse') return { mode: 'explicit', progress: 0 };
  if (action.type === 'explicitExpand') return { mode: 'expanded', progress: 0 };
  if (action.focusInPanel) return state;
  if (state.mode === 'explicit') return state;
  const raw = computeCollapseProgress(action.scrollTop, action.expandedHeight);
  const progress = snapProgress(raw, action.reducedMotion === true);
  const mode: CollapseMode = progress >= 1 ? 'scroll' : 'expanded';
  // Identical outcome: return the same object so the hook can skip setState.
  return mode === state.mode && progress === state.progress ? state : { mode, progress };
}

/**
 * Write the collapse progress to an element's CSS variable.
 *
 * @param element - Element receiving the CSS custom property, or null.
 * @param progress - Progress in 0..1.
 */
export function writeCollapseProgress(element: HTMLElement | null, progress: number): void {
  element?.style.setProperty(COLLAPSE_PROGRESS_VAR, String(progress));
}

/** Handle for a coalescing requestAnimationFrame throttle. */
export interface RafThrottle {
  /** Queue the callback; at most one frame is pending at a time. */
  schedule: () => void;
  /** Discard any pending frame. */
  cancel: () => void;
}

/**
 * Create an rAF-throttled callback handle. Repeated schedule() calls
 * before the frame fires collapse into a single invocation.
 *
 * @param callback - Function invoked on the next animation frame.
 * @returns The schedule/cancel handle.
 */
export function createRafThrottle(callback: () => void): RafThrottle {
  let frame: number | null = null;
  const run = (): void => {
    frame = null;
    callback();
  };
  return {
    schedule: (): void => {
      if (frame !== null) return;
      frame = typeof globalThis.requestAnimationFrame === 'function'
        ? globalThis.requestAnimationFrame(() => run())
        : (globalThis.setTimeout(run, 16) as unknown as number);
    },
    cancel: (): void => {
      if (frame === null) return;
      if (typeof globalThis.cancelAnimationFrame === 'function') {
        globalThis.cancelAnimationFrame(frame);
      } else {
        globalThis.clearTimeout(frame);
      }
      frame = null;
    },
  };
}

/**
 * Report whether the user prefers reduced motion.
 *
 * @returns True when the prefers-reduced-motion media query matches.
 */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** Options for {@link useScrollCollapse}. */
export interface ScrollCollapseOptions {
  /** Editor scroll container observed for scroll events. */
  scrollRef: RefObject<HTMLElement | null>;
  /** Panel element receiving the collapse-progress CSS variable. */
  panelRef: RefObject<HTMLElement | null>;
  /** Whether scroll collapse is active (>= 640px viewports). */
  enabled: boolean;
  /** Current height of the expandable panel region. */
  expandedHeight: () => number;
}

/** Control surface returned by {@link useScrollCollapse}. */
export interface ScrollCollapseApi {
  /** Current collapse state. */
  state: CollapseState;
  /** Collapse explicitly (chevron); not reversed by scrolling. */
  collapse: () => void;
  /** Expand explicitly (chevron). */
  expand: () => void;
}

/**
 * Track scroll-driven collapse of the metadata panel. Scroll events are
 * throttled through requestAnimationFrame, folded through
 * {@link collapseReducer} and written to the panel's CSS variable.
 * Progress freezes while a field inside the panel has focus and snaps
 * under prefers-reduced-motion.
 *
 * @param options - See {@link ScrollCollapseOptions}.
 * @returns The collapse state plus explicit collapse/expand controls.
 */
export function useScrollCollapse(options: ScrollCollapseOptions): ScrollCollapseApi {
  const { scrollRef, panelRef, enabled, expandedHeight } = options;
  const [state, setState] = useState<CollapseState>(INITIAL_COLLAPSE_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;
  const heightRef = useRef(expandedHeight);
  heightRef.current = expandedHeight;

  const dispatch = useCallback((action: CollapseAction): void => {
    const next = collapseReducer(stateRef.current, action);
    // Same object from the reducer: nothing changed, skip re-render and write.
    if (next === stateRef.current) return;
    stateRef.current = next;
    setState(next);
    writeCollapseProgress(panelRef.current, next.progress);
  }, [panelRef]);

  useEffect(() => {
    const scroller = scrollRef.current;
    const panel = panelRef.current;
    if (!enabled || !scroller || !panel) return undefined;
    // Seed the CSS variable once; skipped dispatches no longer write it.
    writeCollapseProgress(panel, stateRef.current.progress);
    const throttle = createRafThrottle(() => {
      dispatch({
        type: 'scroll',
        scrollTop: scroller.scrollTop,
        expandedHeight: heightRef.current(),
        focusInPanel: panel.contains(panel.ownerDocument.activeElement),
        reducedMotion: prefersReducedMotion(),
      });
    });
    const onScroll = (): void => throttle.schedule();
    scroller.addEventListener('scroll', onScroll);
    throttle.schedule();
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      throttle.cancel();
    };
  }, [enabled, dispatch, panelRef, scrollRef]);

  const collapse = useCallback(() => dispatch({ type: 'explicitCollapse' }), [dispatch]);
  const expand = useCallback(() => dispatch({ type: 'explicitExpand' }), [dispatch]);
  return { state, collapse, expand };
}
