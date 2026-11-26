import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { RefObject } from 'react';
import { useDismiss } from '../surface/use-dismiss';
import { headerOverlayReducer } from './header-overlay';
import type { HeaderOverlay } from './header-overlay';

/** State, actions and element refs returned by {@link useHeaderOverlays}. */
export interface HeaderOverlays {
  /** Which header overlay is currently visible. */
  view: HeaderOverlay;
  /** Open the details panel from closed, or close any open overlay. */
  toggleDetails: () => void;
  /** Move from the details panel to the manuscript picker. */
  openPicker: () => void;
  /** Close the picker back to details, or close the details panel. */
  dismiss: () => void;
  /** Choose a manuscript and close every overlay. */
  pick: () => void;
  /** Ref to the element wrapping the header and its overlays. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Ref to the title trigger, focused when overlays close. */
  triggerRef: RefObject<HTMLButtonElement | null>;
  /** Ref to the switch manuscript button, focused when the picker closes. */
  switchRef: RefObject<HTMLButtonElement | null>;
}

/**
 * Drive the header details panel and manuscript picker as one overlay state
 * machine.
 *
 * Dismisses an open overlay on Escape or an outside press, closes every
 * overlay when the project drawer opens, and restores focus to the title
 * trigger when an overlay closes or to the switch manuscript button when the
 * picker returns to the details panel.
 *
 * @param sidebarOpen - Whether the project drawer is currently open.
 * @returns The current overlay view, its actions and the element refs.
 */
export function useHeaderOverlays(sidebarOpen: boolean): HeaderOverlays {
  const [view, dispatch] = useReducer(headerOverlayReducer, 'closed');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const switchRef = useRef<HTMLButtonElement | null>(null);
  const previousView = useRef<HeaderOverlay>('closed');

  const toggleDetails = useCallback((): void => dispatch('toggleDetails'), []);
  const openPicker = useCallback((): void => dispatch('openPicker'), []);
  const dismiss = useCallback((): void => dispatch('dismiss'), []);
  const pick = useCallback((): void => dispatch('pick'), []);

  useDismiss(view !== 'closed', containerRef, dismiss);

  useEffect(() => {
    const previous = previousView.current;
    if (view === 'closed' && previous !== 'closed') {
      triggerRef.current?.focus();
    } else if (previous === 'picker' && view === 'details') {
      switchRef.current?.focus();
    }
    previousView.current = view;
  }, [view]);

  useEffect(() => {
    if (sidebarOpen) dispatch('drawerOpened');
  }, [sidebarOpen]);

  return {
    view,
    toggleDetails,
    openPicker,
    dismiss,
    pick,
    containerRef,
    triggerRef,
    switchRef,
  };
}
