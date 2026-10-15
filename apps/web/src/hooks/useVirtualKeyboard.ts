import { useEffect, useState } from 'react';

/**
 * Height reduction (in px) below which the viewport shrink is not considered
 * an on-screen keyboard. Mobile browsers resize the visual viewport by
 * hundreds of pixels; small deltas are browser chrome or pinch zoom.
 */
const OPEN_THRESHOLD_PX = 150;

/** Current on-screen keyboard state. */
export interface VirtualKeyboardState {
  /** True when a coarse pointer and a shrunken visual viewport indicate an open keyboard. */
  open: boolean;
  /** `window.innerHeight` minus `visualViewport.height` (0 when the viewport is unknown). */
  bottomOffset: number;
}

/**
 * Read the current keyboard state from the environment. The keyboard is
 * considered open only on coarse-pointer devices (`pointer: coarse` media
 * query) when the visual viewport sits more than {@link OPEN_THRESHOLD_PX}
 * below the layout viewport. The bottom offset is the literal difference
 * `innerHeight - visualViewport.height`.
 *
 * @returns The current keyboard state.
 */
function readState(): VirtualKeyboardState {
  const viewport = window.visualViewport;
  if (!viewport) {
    return { open: false, bottomOffset: 0 };
  }
  const bottomOffset = window.innerHeight - viewport.height;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return { open: coarse && bottomOffset > OPEN_THRESHOLD_PX, bottomOffset };
}

/**
 * Track the on-screen software keyboard. On coarse-pointer devices the
 * keyboard is reported open when the visual viewport shrinks more than
 * {@link OPEN_THRESHOLD_PX} below `window.innerHeight`; the state updates on
 * every `visualViewport` resize event.
 *
 * @returns The current open flag and bottom offset for positioning bars above the keyboard.
 */
export function useVirtualKeyboard(): VirtualKeyboardState {
  const [state, setState] = useState<VirtualKeyboardState>(readState);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }
    const onChange = (): void => setState(readState());
    viewport.addEventListener('resize', onChange);
    onChange();
    return () => viewport.removeEventListener('resize', onChange);
  }, []);

  return state;
}
