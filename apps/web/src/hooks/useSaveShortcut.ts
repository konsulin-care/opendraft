import { useEffect, useRef } from 'react';

/** Minimal saver capability needed by the save shortcut. */
export interface Flushable {
  /** Save pending content (if any) immediately; a no-op when nothing is pending. */
  flush(): void;
}

/**
 * Registers a window-level Cmd/Ctrl+S handler that flushes the pending save.
 *
 * The browser's native Save dialog is blocked (preventDefault) whenever
 * Cmd/Ctrl+S is pressed, even when no save is pending — the flush itself is a
 * silent no-op in that case. All other key events pass through untouched and
 * stopPropagation is never called, so application-level shortcuts keep working.
 *
 * @param saver - Saver whose flush is invoked on Cmd/Ctrl+S.
 * @returns void
 */
export function useSaveShortcut(saver: Flushable): void {
  const saverRef = useRef(saver);
  saverRef.current = saver;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat) return;
      if (!event.metaKey && !event.ctrlKey) return;
      if (event.code !== 'KeyS' && event.key !== 's') return;
      event.preventDefault();
      saverRef.current.flush();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);
}
