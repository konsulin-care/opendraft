import { useLayoutEffect, useRef, useState } from 'react';
import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import type { LucideIcon } from 'lucide-react';

/** One selectable item in a {@link ToolbarMenu} dropdown. */
export interface ToolbarMenuItem {
  /** Accessible name of the menu item. */
  label: string;
  /** Icon rendered next to the label. */
  icon: LucideIcon;
  /** Marks the item reflecting the current selection (`aria-checked`). */
  checked?: boolean;
  /** Runs the associated command; the menu closes afterwards. */
  onSelect: () => void;
}

/** Props for {@link ToolbarMenu}. */
export interface ToolbarMenuProps {
  /** Accessible name of the trigger button. */
  label: string;
  /** Icon rendered in the trigger button. */
  icon: LucideIcon;
  /** Items shown in the dropdown when open. */
  items: ToolbarMenuItem[];
  /** Disables the trigger, e.g. in source mode. */
  disabled?: boolean;
}

const TRIGGER_CLASS =
  'inline-flex h-8 shrink-0 items-center gap-0.5 rounded-md px-1.5 text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500 disabled:cursor-not-allowed disabled:opacity-40';

const MENU_CLASS =
  'fixed z-50 min-w-36 rounded-md border border-gray-200 bg-white p-1 shadow-lg';

const ITEM_CLASS =
  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100';

/**
 * Position the open menu under its trigger with floating-ui. Falls back to
 * no movement when either element is not mounted.
 *
 * @param trigger - Trigger button element.
 * @param menu - Menu panel element.
 */
function positionMenu(trigger: HTMLElement | null, menu: HTMLElement | null): void {
  if (!trigger || !menu) return;
  void computePosition(trigger, menu, {
    placement: 'bottom-start',
    middleware: [offset(4), flip(), shift()],
  }).then(({ x, y }) => {
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
  });
}

/** Props for the dropdown panel; sees the open state from {@link ToolbarMenu}. */
interface MenuPanelProps {
  items: ToolbarMenuItem[];
  onSelect: () => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
}

/** The floating menu panel; positioned under the trigger by the parent. */
function MenuPanel({ items, onSelect, menuRef }: MenuPanelProps) {
  return (
    <div ref={menuRef} role="menu" className={MENU_CLASS}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            type="button"
            role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
            aria-label={item.label}
            aria-checked={item.checked}
            className={ITEM_CLASS}
            onClick={() => {
              item.onSelect();
              onSelect();
            }}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Icon-plus-label toolbar button that opens a floating dropdown menu,
 * positioned with `@floating-ui/dom` under the trigger. Used for the
 * Paragraph style and Insert groups.
 *
 * @param props - See {@link ToolbarMenuProps}.
 * @returns The trigger button plus, when open, the menu panel.
 */
export function ToolbarMenu({ label, icon: Icon, items, disabled }: ToolbarMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (open) positionMenu(triggerRef.current, menuRef.current);
  }, [open, items]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        className={TRIGGER_CLASS}
        onMouseDown={(event) => event.preventDefault()}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && <MenuPanel items={items} onSelect={() => setOpen(false)} menuRef={menuRef} />}
    </div>
  );
}
