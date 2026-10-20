import type { LucideIcon } from 'lucide-react';

/** Props for {@link ToolbarButton}. */
export interface ToolbarButtonProps {
  /** Accessible name and tooltip for the button. */
  label: string;
  /** Icon rendered inside the button. */
  icon: LucideIcon;
  /** Runs the associated command. */
  onClick: () => void;
  /** Disables the button, e.g. formatting actions in source mode. */
  disabled?: boolean;
  /** Toggle state; renders `aria-pressed` when provided. */
  pressed?: boolean;
  /** Receives the underlying button element, e.g. for overflow measurement. */
  measureRef?: (element: HTMLButtonElement | null) => void;
}

const BUTTON_CLASS =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500 disabled:cursor-not-allowed disabled:opacity-40';

/**
 * Icon-only toolbar button with an accessible name. Prevents the default on
 * mousedown and pointerdown so clicking the button does not collapse the
 * editor selection before the command runs.
 *
 * @param props - See {@link ToolbarButtonProps}.
 * @returns The rendered button element.
 */
export function ToolbarButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  pressed,
  measureRef,
}: ToolbarButtonProps) {
  return (
    <button
      ref={measureRef}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      className={BUTTON_CLASS}
      onMouseDown={(event) => event.preventDefault()}
      onPointerDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
