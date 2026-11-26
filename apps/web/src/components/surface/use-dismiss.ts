import type { RefObject } from 'react';
import { useEffect } from 'react';

/**
 * Dismiss an open surface on Escape or on a mouse press outside its container.
 *
 * Registers listeners only while open and removes them on close or unmount.
 * The caller owns the open state; this hook is stateless.
 *
 * @param open - Whether the surface is currently open.
 * @param containerRef - Ref to the element that contains the surface content.
 * @param onDismiss - Called when Escape or an outside press happens while open.
 */
export function useDismiss(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onDismiss: () => void,
): void {
  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onDismiss();
    };
    const handleMouseDown = (event: MouseEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) onDismiss();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [open, containerRef, onDismiss]);
}
