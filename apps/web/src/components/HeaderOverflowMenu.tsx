import { useEffect, useRef, useState } from 'react';
import { EllipsisVertical } from 'lucide-react';
import type { EditorMode } from './ModeSwitch';

/** Props for {@link HeaderOverflowMenu}. */
export interface HeaderOverflowMenuProps {
  /** Current editing mode; the menu offers the opposite mode. */
  mode: EditorMode;
  /** Called when the user picks an editing mode. */
  onSelectMode: (mode: EditorMode) => void;
  /** Called when the Commit action is activated. */
  onCommit: () => void;
}

const MENU_ITEM = 'block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100';

const ICON_BUTTON =
  'inline-flex items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500';

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

/**
 * Overflow menu for small screens: switches editing mode and commits.
 *
 * @param props - See {@link HeaderOverflowMenuProps}.
 */
export function HeaderOverflowMenu({ mode, onSelectMode, onCommit }: HeaderOverflowMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const closeMenu = useRef(() => setMenuOpen(false)).current;
  useOutsideClose(menuOpen, menuRef, closeMenu);

  const switchTarget: EditorMode = mode === 'wysiwyg' ? 'source' : 'wysiwyg';

  return (
    <div className="relative md:hidden" ref={menuRef}>
      <button
        type="button"
        aria-label="More actions"
        title="More actions"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
        className={ICON_BUTTON}
      >
        <EllipsisVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      {menuOpen && (
        <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            className={MENU_ITEM}
            onClick={() => {
              setMenuOpen(false);
              onSelectMode(switchTarget);
            }}
          >
            Switch to {switchTarget === 'source' ? 'Source' : 'Visual'}
          </button>
          <button
            type="button"
            className={MENU_ITEM}
            onClick={() => {
              setMenuOpen(false);
              onCommit();
            }}
          >
            Commit changes
          </button>
        </div>
      )}
    </div>
  );
}
