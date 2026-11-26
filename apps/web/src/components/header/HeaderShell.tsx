import type { ReactNode } from 'react';
import { APP_BAR_HEIGHT } from '../app-bar-layout';

/** Props for {@link HeaderShell}. */
export interface HeaderShellProps {
  /** Leading control shown before the title, usually the book icon. */
  leading?: ReactNode;
  /** Line one of the title column; may itself be an editable field. */
  title: ReactNode;
  /** Line two, read-only content describing the project. */
  subtitle?: ReactNode;
  /** Status content shown next to the title column. */
  extra?: ReactNode;
  /** Main action, usually the primary button. */
  action?: ReactNode;
  /** Account menu at the far right. */
  userMenu?: ReactNode;
  /**
   * Optional details panel rendered inside the header after the main row.
   * When supplied, the subtitle is hidden below the `md` breakpoint to make
   * room for the panel on narrow screens.
   */
  panel?: ReactNode;
}

/**
 * Shared two-line header used by the reader and the editor.
 *
 * The main row places the leading slot next to a flexible title column: the
 * title on line one and a plain, ellipsis-truncated subtitle on line two.
 * Status content, the main action and the account menu follow on the right.
 * An optional panel slot is rendered inside the header after that row; the
 * header is relatively positioned so the panel can anchor to it. Supplying a
 * panel hides the subtitle below `md`, leaving the reader header unchanged.
 * The bar keeps the app bar height, compact spacing and border styling of the
 * editor header, and the title column keeps a minimum width so the layout
 * holds at 320px.
 *
 * @param props - See {@link HeaderShellProps}.
 * @returns The shared header shell with its optional details panel.
 */
export function HeaderShell({
  leading,
  title,
  subtitle,
  extra,
  action,
  userMenu,
  panel,
}: HeaderShellProps) {
  const subtitleClassName =
    panel !== undefined
      ? 'hidden w-full truncate text-xs font-normal text-gray-700 md:block'
      : 'block w-full truncate text-xs font-normal text-gray-700';

  return (
    <header
      className={`relative flex flex-col gap-1.5 border-b border-gray-200 bg-white px-2 py-2 sm:gap-2 sm:px-3 ${APP_BAR_HEIGHT}`}
      data-testid="header-shell"
    >
      <div className="flex min-h-0 flex-1 items-center gap-1.5 sm:gap-2">
        {leading}
        <div
          className="flex h-9 min-w-[7rem] flex-1 flex-col items-start justify-center text-left"
          data-testid="header-title-column"
        >
          <div className="min-w-0 max-w-full">{title}</div>
          {subtitle !== undefined && <span className={subtitleClassName}>{subtitle}</span>}
        </div>
        {extra}
        {action}
        {userMenu}
      </div>
      {panel}
    </header>
  );
}
