/**
 * Responsive header frame shared by the editor and the reader.
 *
 * Both headers follow one contract at the md breakpoint: below md the frame
 * renders the compact title slot (a trigger that opens the details panel), the
 * manuscript switcher lives inside that panel, and the repo subtitle is hidden;
 * from md up it renders the wide title slot and keeps the panel md-hidden.
 * Owning the overlay state, the panel wrapper and the two CSS-switched title
 * slots here keeps that contract in exactly one place instead of duplicating
 * the `md:` class pairs in each header.
 */

import type { ReactNode } from 'react';
import { HeaderShell } from './HeaderShell';
import { useHeaderOverlays } from './use-header-overlays';
import type { HeaderOverlays } from './use-header-overlays';

/** Props for {@link HeaderFrame}. */
export interface HeaderFrameProps {
  /** Leading control shown before the title, usually the book button. */
  leading?: ReactNode;
  /** Title slot shown below md; receives the overlay actions and refs. */
  compact: (overlays: HeaderOverlays) => ReactNode;
  /** Title slot shown from md up, usually the inline title and switcher. */
  wide?: ReactNode;
  /** Line two of the title column, hidden below md by the shell. */
  subtitle?: ReactNode;
  /** Status content shown next to the title column. */
  extra?: ReactNode;
  /** Main action, usually the primary button. */
  action?: ReactNode;
  /** Account menu at the far right. */
  userMenu?: ReactNode;
  /** Details panel rendered below the bar; receives the overlay actions. */
  panel: (overlays: HeaderOverlays) => ReactNode;
  /** Whether the project drawer is open; defaults to false. */
  sidebarOpen?: boolean;
  /** Optional test id on the element wrapping the header and its panels. */
  testId?: string;
}

/**
 * Render the responsive header frame with both title slots and the panel slot.
 *
 * @param props - See {@link HeaderFrameProps}.
 * @returns The header plus its md-hidden details panel.
 */
export function HeaderFrame({
  leading,
  compact,
  wide,
  subtitle,
  extra,
  action,
  userMenu,
  panel,
  sidebarOpen = false,
  testId,
}: HeaderFrameProps) {
  const overlays = useHeaderOverlays(sidebarOpen);
  return (
    <div data-testid={testId} ref={overlays.containerRef}>
      <HeaderShell
        leading={leading}
        title={
          <>
            <span
              className="flex min-w-0 items-center gap-1 md:hidden"
              data-testid="header-compact-title"
            >
              {compact(overlays)}
            </span>
            {wide !== undefined && (
              <span
                className="hidden min-w-0 items-center gap-1 md:flex"
                data-testid="header-wide-title"
              >
                {wide}
              </span>
            )}
          </>
        }
        subtitle={subtitle}
        extra={extra}
        action={action}
        userMenu={userMenu}
        panel={<div className="md:hidden" data-testid="header-panel-slot">{panel(overlays)}</div>}
      />
    </div>
  );
}

export default HeaderFrame;
