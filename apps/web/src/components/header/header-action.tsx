/**
 * Shared primitives for the main action button in the app headers.
 *
 * The editor draft action and the reader action keep the same metrics and the
 * same small-screen behaviour: the icon is always visible while the label only
 * appears from 400px up, so the button still fits beside the title on a phone.
 * Every class stays a literal string so Tailwind v4 can scan it statically.
 */

/** Icon size class shared by the header action buttons. */
export const HEADER_ACTION_ICON = 'h-4 w-4';

/**
 * Button metrics shared by the header action buttons, without corner
 * rounding so split buttons and single buttons can each pick their shape.
 */
export const HEADER_ACTION_METRICS =
  'inline-flex min-h-9 shrink-0 items-center gap-2 whitespace-nowrap bg-black px-3 py-1 text-sm font-medium text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50';

/** Single-button action styling: the shared metrics plus rounded corners. */
export const HEADER_ACTION_BUTTON = `${HEADER_ACTION_METRICS} rounded-md`;

/** Props for {@link HeaderActionLabel}. */
export interface HeaderActionLabelProps {
  /** Visible action name; also used as the button's accessible name. */
  label: string;
}

/**
 * Action label that collapses below 400px, leaving the icon in the button.
 *
 * @param props - See {@link HeaderActionLabelProps}.
 * @returns The label span, hidden on the narrowest screens.
 */
export function HeaderActionLabel({ label }: HeaderActionLabelProps) {
  return <span className="hidden min-[400px]:inline">{label}</span>;
}
