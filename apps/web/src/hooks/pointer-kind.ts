/** Minimal shape of a pointer event needed to classify the input device. */
export interface PointerKindEvent {
  /** The `PointerEvent.pointerType` value, e.g. `'touch'`, `'mouse'` or `'pen'`. */
  pointerType: string;
}

/** Value returned by {@link createPointerKindTracker}. */
export interface PointerKindTracker {
  /** Remember the pointer type of the latest interaction. */
  record(event: PointerKindEvent): void;
  /** True only when the last recorded pointer type was `'touch'`. */
  isTouch(): boolean;
}

/**
 * Create a tracker that classifies the most recent pointer interaction.
 *
 * Touch versus mouse is decided per interaction from the last
 * `PointerEvent.pointerType` rather than from viewport width, so hybrid
 * devices behave correctly.
 *
 * @returns A tracker with `record` and `isTouch`.
 */
export function createPointerKindTracker(): PointerKindTracker {
  let lastPointerType: string | null = null;

  return {
    record(event: PointerKindEvent): void {
      lastPointerType = event.pointerType;
    },
    isTouch(): boolean {
      return lastPointerType === 'touch';
    },
  };
}
