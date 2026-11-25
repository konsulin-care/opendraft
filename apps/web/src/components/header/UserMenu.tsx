import { useEffect, useRef, useState } from 'react';
import type { BffSession } from '../../github/bff-client';
import { installUrl, loginUrl } from '../../github/bff-client';
import { useOutsideClose } from '../HeaderOverflowMenu';

/** Props for {@link UserMenu}. */
export interface UserMenuProps {
  /** Current BFF session, or null when signed out. */
  session: BffSession | null;
  /** Relative path to reopen after sign-in or installation. */
  returnTo: string;
  /** Called when the user signs out. */
  onLogout: () => void;
  /** Whether GitHub login is available at all; false renders nothing. */
  loginEnabled: boolean;
}

const MENU_ITEM =
  'block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500';

const AVATAR_BUTTON =
  'inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500';

/** SVG path data of the GitHub brand mark. */
const GITHUB_MARK_PATH =
  'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z';

/**
 * GitHub brand mark rendered as an inline SVG.
 *
 * lucide-react no longer ships brand icons, so the menu draws the mark itself.
 */
function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d={GITHUB_MARK_PATH} />
    </svg>
  );
}

/** Props for {@link SignedInMenu}. */
interface SignedInMenuProps {
  session: BffSession;
  returnTo: string;
  onLogout: () => void;
  onClose: () => void;
}

/**
 * Menu entries shown when a session exists.
 *
 * @param props - See {@link SignedInMenuProps}.
 */
function SignedInMenu({ session, returnTo, onLogout, onClose }: SignedInMenuProps) {
  return (
    <>
      <div className="px-3 py-2 text-xs text-gray-500">Signed in as @{session.login}</div>
      <div role="separator" className="my-1 border-t border-gray-200" />
      <a role="menuitem" href={installUrl(returnTo)} className={MENU_ITEM}>
        Manage GitHub access
      </a>
      <button
        type="button"
        role="menuitem"
        className={MENU_ITEM}
        onClick={() => {
          onClose();
          onLogout();
        }}
      >
        Sign out
      </button>
    </>
  );
}

/**
 * Menu content for signed-out visitors: only the sign-in link.
 *
 * @param props - Overrides for the menu.
 * @param props.returnTo - Relative path to reopen after sign-in.
 */
function SignedOutMenu({ returnTo }: { returnTo: string }) {
  return (
    <a role="menuitem" href={loginUrl(returnTo)} className={MENU_ITEM}>
      Sign in with GitHub
    </a>
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

/** Props for {@link AccountButton}. */
interface AccountButtonProps {
  session: BffSession | null;
  menuOpen: boolean;
  onToggle: () => void;
}

/**
 * Round avatar or GitHub mark that toggles the account menu.
 *
 * @param props - See {@link AccountButtonProps}.
 */
function AccountButton({ session, menuOpen, onToggle }: AccountButtonProps) {
  return (
    <button
      type="button"
      aria-label="Account"
      title="Account"
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      onClick={onToggle}
      className={AVATAR_BUTTON}
    >
      {session ? (
        <img
          src={`https://avatars.githubusercontent.com/u/${session.id}?s=64`}
          alt={`@${session.login}`}
          className="h-full w-full object-cover"
        />
      ) : (
        <GitHubMark />
      )}
    </button>
  );
}

/**
 * Round account avatar with a dropdown of GitHub account actions.
 *
 * Signed out it shows a GitHub mark whose menu offers the sign-in link.
 * Signed in it shows the GitHub avatar and offers installation management
 * and sign-out.
 *
 * @param props - See {@link UserMenuProps}.
 */
export function UserMenu({ session, returnTo, onLogout, loginEnabled }: UserMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const closeMenu = useRef(() => setMenuOpen(false)).current;
  useOutsideClose(menuOpen, menuRef, closeMenu);
  useEscapeClose(menuOpen, closeMenu);

  if (!loginEnabled) return null;

  return (
    <div className="relative" ref={menuRef}>
      <AccountButton
        session={session}
        menuOpen={menuOpen}
        onToggle={() => setMenuOpen((open) => !open)}
      />
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-56 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {session ? (
            <SignedInMenu
              session={session}
              returnTo={returnTo}
              onLogout={onLogout}
              onClose={closeMenu}
            />
          ) : (
            <SignedOutMenu returnTo={returnTo} />
          )}
        </div>
      )}
    </div>
  );
}
