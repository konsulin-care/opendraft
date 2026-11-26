/** Which header overlay is currently visible. */
export type HeaderOverlay = 'closed' | 'details' | 'picker';

/** Actions that drive the header overlay state machine. */
export type HeaderOverlayAction =
  | 'toggleDetails'
  | 'openPicker'
  | 'dismiss'
  | 'pick'
  | 'drawerOpened';

/**
 * Reduce a header overlay action into the next overlay state.
 *
 * @param state - Current overlay state.
 * @param action - Action to apply.
 * @returns The next overlay state.
 */
export function headerOverlayReducer(
  state: HeaderOverlay,
  action: HeaderOverlayAction,
): HeaderOverlay {
  switch (action) {
    case 'toggleDetails':
      return state === 'closed' ? 'details' : 'closed';
    case 'openPicker':
      return state === 'details' ? 'picker' : state;
    case 'dismiss':
      return state === 'picker' ? 'details' : 'closed';
    case 'pick':
    case 'drawerOpened':
      return 'closed';
    default:
      return state;
  }
}
