import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useOutsideClose } from './use-outside-close';

/** One manuscript offered by {@link ManuscriptSwitcher}. */
export interface ManuscriptSwitcherOption {
  /** Folder id of the manuscript, e.g. `alpha`. */
  id: string;
  /** Display title of the manuscript. */
  title: string;
  /** Marks this manuscript as the current one instead of passing an id. */
  current?: boolean;
  /** Alias for {@link ManuscriptSwitcherOption.current}. */
  isCurrent?: boolean;
}

/** Props for {@link ManuscriptSwitcher}. */
export interface ManuscriptSwitcherProps {
  /** Manuscripts to list; fewer than two hides the switcher entirely. */
  manuscripts: readonly ManuscriptSwitcherOption[];
  /** Id of the manuscript currently open. */
  currentId?: string;
  /** Alias for {@link ManuscriptSwitcherProps.currentId}. */
  selectedId?: string;
  /** Alias for {@link ManuscriptSwitcherProps.currentId}. */
  activeId?: string;
  /** Alias for {@link ManuscriptSwitcherProps.currentId}. */
  current?: string;
  /** Alias for {@link ManuscriptSwitcherProps.currentId}. */
  activeManuscriptId?: string;
  /** Called with the id of the chosen manuscript. */
  onSelect: (id: string) => void;
  /** When given, adds an "All manuscripts" entry that calls this handler. */
  onSelectAll?: () => void;
}

const MENU_ITEM =
  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500';

const TRIGGER =
  'inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500';

const MENU_PANEL =
  'absolute left-0 top-full z-30 mt-1 w-56 rounded-md border border-gray-200 bg-white py-1 shadow-lg';

/**
 * Resolve the current manuscript id from the accepted prop aliases.
 *
 * @param props - Switcher props that may carry the id under any alias.
 * @returns The first defined id, or undefined when none was supplied.
 */
function resolveCurrentId(props: ManuscriptSwitcherProps): string | undefined {
  const flagged = props.manuscripts.find((item) => item.current === true || item.isCurrent === true);
  return (
    props.currentId ?? props.selectedId ?? props.activeId ?? props.current ??
    props.activeManuscriptId ?? flagged?.id
  );
}

/**
 * Close an open menu when Escape is pressed.
 *
 * @param open - Whether the menu is currently open.
 * @param onClose - Called when Escape is pressed while open.
 */
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

/** Props for the popup panel inside {@link ManuscriptSwitcher}. */
interface SwitcherMenuProps {
  manuscripts: readonly ManuscriptSwitcherOption[];
  currentId: string | undefined;
  onSelect: (id: string) => void;
  onSelectAll?: () => void;
  choose: (handler: () => void) => void;
}

/**
 * Popup listing manuscripts plus the optional "All manuscripts" entry.
 *
 * @param props - Menu contents and selection callbacks.
 * @returns The menu panel.
 */
function SwitcherMenu(props: SwitcherMenuProps) {
  const { manuscripts, currentId, onSelect, onSelectAll, choose } = props;
  return (
    <div role="menu" data-testid="manuscript-switcher-menu" className={MENU_PANEL}>
      {manuscripts.map((manuscript) => {
        const checked = manuscript.id === currentId;
        return (
          <button
            key={manuscript.id}
            type="button"
            role="menuitemcheckbox"
            aria-checked={checked}
            className={MENU_ITEM}
            onClick={() => choose(() => onSelect(manuscript.id))}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              {checked && <Check className="h-4 w-4" aria-hidden="true" />}
            </span>
            <span className="truncate">{manuscript.title}</span>
          </button>
        );
      })}
      {onSelectAll !== undefined && (
        <button
          type="button"
          role="menuitem"
          className={MENU_ITEM}
          onClick={() => choose(onSelectAll)}
        >
          <span className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">All manuscripts</span>
        </button>
      )}
    </div>
  );
}

/**
 * Chevron button next to a manuscript title that opens a menu of manuscripts.
 *
 * The current manuscript is marked with a check via `aria-checked`, and an
 * optional "All manuscripts" entry appears when `onSelectAll` is provided.
 * Choosing an entry calls its handler and closes the menu. With fewer than
 * two manuscripts no trigger is rendered.
 *
 * @param props - See {@link ManuscriptSwitcherProps}.
 * @returns The switcher, or null when there is nothing to switch between.
 */
export function ManuscriptSwitcher(props: ManuscriptSwitcherProps) {
  const { manuscripts, onSelect, onSelectAll } = props;
  const currentId = resolveCurrentId(props);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const closeMenu = useRef(() => setMenuOpen(false)).current;
  useOutsideClose(menuOpen, menuRef, closeMenu);
  useEscapeClose(menuOpen, closeMenu);

  if (manuscripts.length < 2) return null;

  /** Run a selection handler and close the menu. */
  const choose = (handler: () => void): void => {
    handler();
    setMenuOpen(false);
  };

  return (
    <span className="relative inline-flex" ref={menuRef} data-testid="manuscript-switcher">
      <button
        type="button"
        aria-label="Switch manuscript"
        title="Switch manuscript"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
        className={TRIGGER}
      >
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </button>
      {menuOpen && (
        <SwitcherMenu
          manuscripts={manuscripts}
          currentId={currentId}
          onSelect={onSelect}
          onSelectAll={onSelectAll}
          choose={choose}
        />
      )}
    </span>
  );
}
