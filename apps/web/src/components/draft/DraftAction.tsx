/**
 * Split action button for the draft workflow.
 *
 * The main part runs the next step (save, send, or start a new draft) and the
 * chevron opens a menu of secondary draft actions. While a step is running
 * both parts are disabled and the main part shows a spinner plus a progress
 * label so the user gets immediate feedback.
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LoaderCircle } from 'lucide-react';
import { useOutsideClose } from '../HeaderOverflowMenu';

/** One entry in the chevron menu. */
export interface DraftActionMenuItem {
  /** Stable identifier reported to `onMenu`. */
  id: string;
  /** Text shown in the menu. */
  label: string;
  /** Disables this entry without hiding it. */
  disabled?: boolean;
}

/** A menu entry, either plain text or a full menu item. */
export type DraftActionItem = string | DraftActionMenuItem;

/** Props for {@link DraftAction}. */
export interface DraftActionProps {
  /** Label of the main action. */
  label: string;
  /** Runs the main action. */
  onPrimary: () => void;
  /** Called with the chosen item when a menu entry is activated. */
  onMenu: (item: DraftActionItem) => void;
  /** Entries offered by the chevron menu. */
  items?: readonly DraftActionItem[];
  /** Disables both parts and shows the spinner and progress label. */
  busy?: boolean;
  /** Progress text shown instead of the label while busy. */
  busyLabel?: string;
  /** Alias for {@link DraftActionProps.busyLabel}. */
  progressLabel?: string;
  /** Disables both parts without showing progress. */
  disabled?: boolean;
  /** Accessible name of the chevron button. */
  menuLabel?: string;
}

const MAIN_BUTTON =
  'inline-flex min-h-9 items-center gap-2 rounded-l-md bg-black px-3 py-1 text-sm font-medium text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50';
const CHEVRON_BUTTON =
  'inline-flex min-h-9 items-center justify-center rounded-r-md border-l border-gray-700 bg-black px-2 py-1 text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50';
const MENU_PANEL =
  'absolute right-0 top-full z-30 mt-1 w-56 rounded-md border border-gray-200 bg-white py-1 shadow-lg';
const MENU_ITEM =
  'block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Read the visible text of a menu entry.
 *
 * @param item - Plain string or menu item.
 * @returns Text shown in the menu.
 */
function itemLabel(item: DraftActionItem): string {
  return typeof item === 'string' ? item : item.label;
}

/**
 * Read whether a menu entry is disabled.
 *
 * @param item - Plain string or menu item.
 * @returns True when the entry cannot be chosen.
 */
function itemDisabled(item: DraftActionItem): boolean {
  return typeof item === 'string' ? false : item.disabled === true;
}

/**
 * Build a React key for a menu entry.
 *
 * @param item - Plain string or menu item.
 * @param index - Position of the entry in the list.
 * @returns Stable key for the entry.
 */
function itemKey(item: DraftActionItem, index: number): string {
  return typeof item === 'string' ? `item-${index}-${item}` : item.id;
}

/** Close an open menu when Escape is pressed. */
function useEscapeClose(open: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);
}

/** Props for {@link ActionMenu}. */
interface ActionMenuProps {
  items: readonly DraftActionItem[];
  onChoose: (item: DraftActionItem) => void;
}

/**
 * Menu panel listing the secondary draft actions.
 *
 * @param props - See {@link ActionMenuProps}.
 */
function ActionMenu({ items, onChoose }: ActionMenuProps) {
  return (
    <div role="menu" className={MENU_PANEL}>
      {items.map((item, index) => (
        <button
          key={itemKey(item, index)}
          type="button"
          role="menuitem"
          disabled={itemDisabled(item)}
          className={MENU_ITEM}
          onClick={() => onChoose(item)}
        >
          {itemLabel(item)}
        </button>
      ))}
    </div>
  );
}

/** Props for {@link PrimaryButton}. */
interface PrimaryButtonProps {
  label: string;
  progress: string;
  busy: boolean;
  blocked: boolean;
  onPrimary: () => void;
}

/**
 * Main part of the split button, showing the spinner and progress while busy.
 *
 * @param props - See {@link PrimaryButtonProps}.
 */
function PrimaryButton({ label, progress, busy, blocked, onPrimary }: PrimaryButtonProps) {
  return (
    <button
      type="button"
      onClick={onPrimary}
      disabled={blocked}
      aria-busy={busy}
      className={MAIN_BUTTON}
    >
      {busy ? (
        <LoaderCircle
          className="h-4 w-4 animate-spin"
          aria-hidden="true"
          data-testid="draft-action-spinner"
        />
      ) : null}
      <span>{busy ? progress : label}</span>
    </button>
  );
}

/** Props for {@link ChevronButton}. */
interface ChevronButtonProps {
  label: string;
  open: boolean;
  disabled: boolean;
  onToggle: () => void;
}

/**
 * Chevron toggle that opens and closes the secondary action menu.
 *
 * @param props - See {@link ChevronButtonProps}.
 */
function ChevronButton({ label, open, disabled, onToggle }: ChevronButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={onToggle}
      disabled={disabled}
      className={CHEVRON_BUTTON}
    >
      <ChevronDown className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

/**
 * Render the split draft action button.
 *
 * The main part calls `onPrimary`. The chevron toggles a `role="menu"` panel
 * whose entries call `onMenu` with the chosen item and close the menu. While
 * `busy` both parts are disabled and the main part shows a spinning loader and
 * the progress label.
 *
 * @param props - See {@link DraftActionProps}.
 * @returns The split button and its optional menu.
 */
export function DraftAction({
  label,
  onPrimary,
  onMenu,
  items = [],
  busy = false,
  busyLabel,
  progressLabel,
  disabled = false,
  menuLabel = 'More actions',
}: DraftActionProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const closeMenu = useRef(() => setMenuOpen(false)).current;
  const blocked = busy || disabled;
  const progress = busyLabel ?? progressLabel ?? label;
  useOutsideClose(menuOpen, menuRef, closeMenu);
  useEscapeClose(menuOpen, closeMenu);

  /** Run a secondary action and close the menu. */
  const choose = (item: DraftActionItem): void => {
    if (itemDisabled(item)) return;
    setMenuOpen(false);
    onMenu(item);
  };

  return (
    <div className="relative inline-flex" ref={menuRef}>
      <PrimaryButton
        label={label}
        progress={progress}
        busy={busy}
        blocked={blocked}
        onPrimary={onPrimary}
      />
      {items.length > 0 ? (
        <>
          <ChevronButton
            label={menuLabel}
            open={menuOpen}
            disabled={blocked}
            onToggle={() => setMenuOpen((open) => !open)}
          />
          {menuOpen ? <ActionMenu items={items} onChoose={choose} /> : null}
        </>
      ) : null}
    </div>
  );
}

export default DraftAction;
