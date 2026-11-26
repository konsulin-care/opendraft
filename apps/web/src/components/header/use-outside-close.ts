import { useEffect } from 'react';

/**
 * Close an open popup when a mouse press lands outside its container.
 *
 * @param open - Whether the popup is currently open.
 * @param containerRef - Ref to the element that contains the popup and its trigger.
 * @param onClose - Called when an outside press happens while open.
 */
export function useOutsideClose(
  open: boolean,
  containerRef: React.RefObject<HTMLDivElement | null>,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!open) return undefined;
    const handleMouseDown = (event: MouseEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open, containerRef, onClose]);
}
