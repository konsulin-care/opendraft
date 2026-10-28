/**
 * Press-and-hold drag behavior for byline name chips.
 *
 * A pointer press shorter than the hold threshold is a plain click: the
 * chip's own `onClick` fires and is let through by
 * {@link UsePressDragResult.filterClick}. Holding the pointer for
 * `holdMs` engages drag mode; releasing over another chip calls
 * `onReorder` with the pressed and dropped indices and suppresses the
 * click that would otherwise follow the release.
 */
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';

/** Default press duration in milliseconds before drag mode engages. */
export const HOLD_MS = 300;

/** Attribute marking a chip as press/drag aware; its value is the chip index. */
export const PRESS_INDEX_ATTR = 'data-press-index';

/** Options for {@link usePressDrag}. */
export interface UsePressDragOptions {
  /** Invoked with (from, to) when a held press is released over another chip. */
  onReorder: (from: number, to: number) => void;
  /** Hold duration in ms before drag mode engages; defaults to {@link HOLD_MS}. */
  holdMs?: number;
}

/** Pointer and click handlers of one press-to-drag interaction. */
export interface UsePressDragResult {
  /** Index of the chip currently held in drag mode, or null. */
  dragging: number | null;
  /** Delegated pointerdown handler for the chip container. */
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  /** Delegated pointerup handler for the chip container. */
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  /** Delegated pointercancel handler that aborts a pending press or drag. */
  onPointerCancel: () => void;
  /** Call from a chip's onClick; false when the click followed a drag and must be ignored. */
  filterClick: () => boolean;
}

/** Cancel a pending hold timer, if armed. */
function clearHold(timer: RefObject<ReturnType<typeof setTimeout> | null>): void {
  if (timer.current !== null) {
    clearTimeout(timer.current);
    timer.current = null;
  }
}

/** Resolve the chip index of a pointer event target, or null. */
function targetIndex(target: EventTarget | null): number | null {
  const chip = target instanceof Element ? target.closest(`[${PRESS_INDEX_ATTR}]`) : null;
  const raw = chip?.getAttribute(PRESS_INDEX_ATTR) ?? null;
  if (raw === null) return null;
  const index = Number(raw);
  return Number.isInteger(index) ? index : null;
}

/**
 * Resolve the drop chip index: the event target, or — when the pointer
 * was captured (touch) — the chip under the pointer coordinates.
 *
 * @param event - The pointerup event.
 * @returns The dropped-on chip index, or null when not over a chip.
 */
function dropIndex(event: ReactPointerEvent<HTMLElement>): number | null {
  const direct = targetIndex(event.target);
  if (direct !== null) return direct;
  if (typeof document.elementFromPoint !== 'function') return null;
  return targetIndex(document.elementFromPoint(event.clientX, event.clientY));
}

/**
 * Press-and-hold drag state machine for a row of index-attributed chips.
 *
 * Attach the returned pointer handlers to the shared container (event
 * delegation) and call {@link UsePressDragResult.filterClick} from each
 * chip's `onClick`.
 *
 * @param options - See {@link UsePressDragOptions}.
 * @returns See {@link UsePressDragResult}.
 */
export function usePressDrag(
  { onReorder, holdMs = HOLD_MS }: UsePressDragOptions,
): UsePressDragResult {
  const [dragging, setDragging] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressed = useRef<number | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => () => clearHold(timer), []);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>): void => {
    const index = targetIndex(event.target);
    suppressClick.current = false;
    if (index === null) return;
    pressed.current = index;
    clearHold(timer);
    timer.current = setTimeout(() => {
      timer.current = null;
      setDragging(index);
    }, holdMs);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>): void => {
    clearHold(timer);
    const from = pressed.current;
    pressed.current = null;
    if (dragging === null || from === null) return;
    suppressClick.current = true;
    setDragging(null);
    const to = dropIndex(event);
    if (to !== null && to !== from) onReorder(from, to);
  };

  const onPointerCancel = (): void => {
    clearHold(timer);
    pressed.current = null;
    setDragging(null);
  };

  const filterClick = (): boolean => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return false;
    }
    return true;
  };

  return { dragging, onPointerDown, onPointerUp, onPointerCancel, filterClick };
}
