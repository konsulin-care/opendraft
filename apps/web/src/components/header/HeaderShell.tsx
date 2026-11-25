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
}

/**
 * Shared two-line header used by the reader and the editor.
 *
 * The leading slot sits next to a flexible title column: the title on line
 * one and a plain, ellipsis-truncated subtitle on line two. Status content,
 * the main action and the account menu follow on the right. The bar keeps
 * the app bar height and border styling of the editor header.
 *
 * @param props - See {@link HeaderShellProps}.
 */
export function HeaderShell({
  leading,
  title,
  subtitle,
  extra,
  action,
  userMenu,
}: HeaderShellProps) {
  return (
    <header
      className={`flex items-center gap-2 border-b border-gray-200 bg-white px-3 py-2 ${APP_BAR_HEIGHT}`}
      data-testid="header-shell"
    >
      {leading}
      <div className="flex h-9 min-w-0 flex-1 flex-col items-start justify-center text-left">
        <div className="min-w-0 max-w-full">{title}</div>
        {subtitle !== undefined && (
          <span className="block w-full truncate text-xs font-normal text-gray-700">
            {subtitle}
          </span>
        )}
      </div>
      {extra}
      {action}
      {userMenu}
    </header>
  );
}
