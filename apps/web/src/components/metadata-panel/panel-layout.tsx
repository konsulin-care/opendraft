/**
 * Layout pieces of the metadata panel: the sticky pinned bar shown on
 * top of the expanded body. The bar stays sticky inside the editor
 * scroll container while the expanded body scrolls away 1:1; the bar
 * title/byline fade in through the panel's `--collapse-progress` CSS
 * variable.
 */
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ScrollCollapseApi } from './scroll-collapse';
import { useScrollCollapse } from './scroll-collapse';
import { useOverlayCollapse } from './overlay-collapse';

/** Props for {@link PinnedBar}. */
export interface PinnedBarProps {
  /** Manuscript title shown in the bar while collapsed. */
  title: string;
  /** Manuscript folder id shown in muted text when the title is empty. */
  folderId: string;
  /** Byline shown in the bar while collapsed. */
  byline: string;
  /** Effective expanded state (false also while scroll-collapsed). */
  expanded: boolean;
  /** Collapse progress in the 0..1 range driving the text fade-in. */
  collapseProgress: number;
  /** Whether the viewport is below the 640px breakpoint. */
  narrow: boolean;
  /** Optional element rendered between the title block and the toggle. */
  badge?: ReactNode;
  /** Chevron toggle handler. */
  onToggle: () => void;
}

/**
 * Pinned bar: title, byline and chevron toggle, closed off by the 1px
 * hairline separator below it. The bar and the separator share one
 * sticky container so the hairline stays pinned under the bar for the
 * whole scroll range; the bar text fades in with the panel's
 * `--collapse-progress` CSS variable. An empty title falls back to the
 * manuscript folder id in muted text instead of a placeholder label.
 *
 * @param props - See {@link PinnedBarProps}.
 * @returns The sticky wrapper containing the bar and separator.
 */
export function PinnedBar({
  title, folderId, byline, expanded, collapseProgress, narrow, badge, onToggle,
}: PinnedBarProps): ReactNode {
  // While explicitly collapsed the text is fully opaque; while expanded
  // it fades in with the collapse progress written by the scroll hook.
  const textStyle = { opacity: expanded ? 'var(--collapse-progress, 0)' : 1 };
  const showText = !expanded || collapseProgress > 0;
  return (
    <div className="sticky top-0 z-10 bg-white">
      <div
        className="flex items-center gap-2 py-2"
        data-testid="metadata-panel-bar"
      >
        <div className="min-w-0 flex-1">
          {showText && (
            <div style={textStyle}>
              <div data-testid="metadata-panel-bar-title" className={narrow ? 'line-clamp-2' : 'truncate'}>
                {title || <span className="text-muted">{folderId}</span>}
              </div>
              {byline && (
                <div className="truncate text-sm text-muted" data-testid="metadata-panel-byline">{byline}</div>
              )}
            </div>
          )}
        </div>
        {badge}
        <button
          type="button"
          data-testid="metadata-panel-toggle"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse manuscript metadata' : 'Expand manuscript metadata'}
          onClick={onToggle}
          className="flex min-h-11 min-w-11 items-center justify-center rounded hover:bg-hover"
        >
          {expanded ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
        </button>
      </div>
      <div data-testid="metadata-panel-separator" className="h-px bg-secondary" />
    </div>
  );
}

/** Props for {@link OverlayLayer}. */
export interface OverlayLayerProps {
  /** Whether the panel currently overlays the editor area. */
  overlay: boolean;
  /** Ref to the layer element; the overlay scroll collapse reads it. */
  scrollerRef?: RefObject<HTMLDivElement | null>;
  /** Pinned bar and panel body rendered inside the layer. */
  children: ReactNode;
}

/**
 * Scroll layer around the pinned bar and panel body. Inline the div
 * is a pass-through (`display: contents` keeps the DOM stable, so the
 * measured body element survives overlay transitions); overlaying it
 * becomes the editor-area overlay with its own vertical scroll.
 *
 * @param props - See {@link OverlayLayerProps}.
 * @returns The layer element wrapping the children.
 */
export function OverlayLayer({ overlay, scrollerRef, children }: OverlayLayerProps): ReactNode {
  return (
    <div
      ref={scrollerRef}
      data-testid={overlay ? 'metadata-panel-overlay' : undefined}
      className={overlay ? 'h-full overflow-y-auto' : 'contents'}
    >
      {children}
    </div>
  );
}

/** Options for {@link usePanelOverlay}. */
export interface PanelOverlayOptions {
  /** Expanded panel body measured against the editor viewport. */
  bodyRef: RefObject<HTMLElement | null>;
  /** Editor scroll container supplying the viewport height. */
  scrollRef: RefObject<HTMLElement | null>;
  /** Whether the panel is expanded (and worth measuring). */
  enabled: boolean;
}

/**
 * Track whether the expanded panel body is taller than the editor
 * scroll container's visible height, i.e. whether the panel must
 * render as an editor-area overlay with its own scroll. A
 * ResizeObserver watches the body and the scroll container. Without a
 * ResizeObserver (jsdom) or with a zero-height scroller the overlay
 * never activates.
 *
 * @param options - See {@link PanelOverlayOptions}.
 * @returns True while the body is taller than the editor viewport.
 */
export function usePanelOverlay(options: PanelOverlayOptions): boolean {
  const { bodyRef, scrollRef, enabled } = options;
  const [tall, setTall] = useState(false);
  useEffect(() => {
    if (!enabled || typeof ResizeObserver === 'undefined') {
      setTall(false);
      return undefined;
    }
    const measure = (): void => {
      const body = bodyRef.current;
      const scroller = scrollRef.current;
      if (!body || !scroller) return;
      const bodyHeight = body.getBoundingClientRect().height || body.offsetHeight || body.clientHeight;
      // A zero clientHeight (jsdom) can never prove the body is taller.
      setTall(scroller.clientHeight > 0 && bodyHeight > scroller.clientHeight);
    };
    const observer = new ResizeObserver(measure);
    if (bodyRef.current) observer.observe(bodyRef.current);
    if (scrollRef.current) observer.observe(scrollRef.current);
    measure();
    return () => observer.disconnect();
  }, [enabled, bodyRef, scrollRef]);
  return tall;
}

/**
 * Pin the editor scroll container at the top when the overlay takes
 * over, so the absolutely positioned panel covers the viewport from
 * scroll offset 0, and reset any scroll-driven collapse to expanded.
 * Runs after the scroll-collapse effect cleanup has detached its
 * listener, so the scroll reset dispatches nothing.
 *
 * @param overlay - Whether the overlay is currently active.
 * @param collapse - Scroll-collapse controls reset on activation.
 * @param scrollRef - Editor scroll container pinned to the top.
 */
export function useOverlayPin(
  overlay: boolean,
  collapse: ScrollCollapseApi,
  scrollRef: RefObject<HTMLElement | null>,
): void {
  const wasOverlay = useRef(false);
  useEffect(() => {
    const activated = overlay && !wasOverlay.current;
    wasOverlay.current = overlay;
    if (!activated) return;
    collapse.expand();
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [overlay, collapse, scrollRef]);
}

/** Options for {@link usePanelLayout}. */
export interface PanelLayoutOptions {
  /** Explicitly expanded state (chevron or persisted preference). */
  expanded: boolean;
  /** Persisting expand/collapse setter. */
  setExpanded: (next: boolean) => void;
  /** Whether the viewport is below the 640px breakpoint. */
  narrow: boolean;
  /** Whether the metadata load has settled. */
  loaded: boolean;
  /** Manuscript root, or null when the file is outside one. */
  manuscriptRoot: string | null;
  /** Panel section receiving the collapse-progress CSS variable. */
  panelRef: RefObject<HTMLElement | null>;
  /** Expanded body measured for the overlay and the scroll progress. */
  bodyRef: RefObject<HTMLDivElement | null>;
  /** Editor scroll container driving the scroll collapse. */
  scrollRef: RefObject<HTMLElement | null>;
  /** Overlay scroll layer driving the overlay collapse progress. */
  overlayRef: RefObject<HTMLElement | null>;
  /** Editor container focused when Esc collapses the panel. */
  editorFocusRef?: RefObject<HTMLElement | null>;
  /** Session-only collapse fired when the overlay scrolls the body out. */
  onOverlayScrollOut: () => void;
}

/** Controls returned by {@link usePanelLayout}. */
export interface PanelLayoutApi {
  /** True while the panel covers the editor area as an overlay. */
  overlay: boolean;
  /** Effective expanded state (false while scroll-collapsed). */
  panelExpanded: boolean;
  /** Collapse progress driving the bar text fade-in. */
  progress: number;
  /** Chevron toggle: re-expands a scroll collapse, otherwise persists. */
  toggle: () => void;
  /** Escape handler collapsing the panel and refocusing the editor. */
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
}

/**
 * Wire the panel layout: overlay detection, the editor scroll-collapse
 * hook, the overlay scroll collapse and the chevron/Escape controls.
 * Scroll collapse is disabled on narrow viewports (full-screen sheet);
 * the editor variant is disabled while the overlay owns the scrolling,
 * and the overlay variant collapses session-only through
 * `onOverlayScrollOut`. Neither scroll collapse is ever persisted.
 *
 * @param options - See {@link PanelLayoutOptions}.
 * @returns The layout state plus the panel's interaction handlers.
 */
export function usePanelLayout(options: PanelLayoutOptions): PanelLayoutApi {
  const {
    expanded, setExpanded, narrow, loaded, manuscriptRoot,
    panelRef, bodyRef, scrollRef, overlayRef, editorFocusRef, onOverlayScrollOut,
  } = options;
  // Height of the expandable region the scroll offset is measured against.
  const expandedHeight = useCallback((): number => {
    const body = bodyRef.current;
    if (!body) return 0;
    return body.getBoundingClientRect().height || body.offsetHeight || body.clientHeight;
  }, [bodyRef]);
  const base = !narrow && loaded && Boolean(manuscriptRoot);
  const tall = usePanelOverlay({ bodyRef, scrollRef, enabled: expanded && base });
  const overlay = tall && expanded;
  const collapse = useScrollCollapse({ scrollRef, panelRef, enabled: base && !overlay, expandedHeight });
  useOverlayPin(overlay, collapse, scrollRef);
  const overlayCollapse = useOverlayCollapse({
    overlayRef, panelRef, enabled: overlay, expandedHeight, onScrolledOut: onOverlayScrollOut,
  });
  const collapsedByScroll = collapse.state.mode === 'scroll';
  const toggle = useCallback(() => {
    if (collapsedByScroll) {
      // Scroll collapse: the chevron re-expands by returning the editor
      // to the top; nothing is persisted.
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
      collapse.expand();
      return;
    }
    setExpanded(!expanded);
  }, [collapse, collapsedByScroll, expanded, scrollRef, setExpanded]);
  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape') return;
    setExpanded(false);
    editorFocusRef?.current?.focus();
  }, [editorFocusRef, setExpanded]);
  return {
    overlay,
    panelExpanded: expanded && !collapsedByScroll,
    progress: overlay ? overlayCollapse.progress : collapse.state.progress,
    toggle,
    onKeyDown,
  };
}
