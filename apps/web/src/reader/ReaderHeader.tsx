/**
 * Reader header with authentication actions.
 *
 * Anonymous visitors get a sign-in link plus an install link, both carrying
 * the current reader path as `return_to`. Signed-in users see their login and
 * a sign-out button that delegates to the session owner.
 */

import type { BffSession } from '../github/bff-client';
import { installUrl, loginUrl } from '../github/bff-client';

/** Props for {@link ReaderHeader}. */
export interface ReaderHeaderProps {
  /** Signed-in session, or null for an anonymous visitor. */
  session: BffSession | null;
  /** Reader path returned to after sign-in, install or sign-out. */
  returnTo: string;
  /** Sign-out handler invoked when the session owner clicks `Sign out`. */
  onLogout: () => void;
  /** Whether GitHub login is configured; defaults to true. */
  loginEnabled?: boolean;
}

/**
 * Render the reader header authentication controls.
 *
 * @param props - See {@link ReaderHeaderProps}.
 * @returns A header with either anonymous links or the signed-in identity.
 */
export function ReaderHeader({
  session,
  returnTo,
  onLogout,
  loginEnabled = true,
}: ReaderHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-outline px-4 py-3">
      <span className="text-sm font-semibold text-black">OpenDraft</span>
      {!loginEnabled ? null : session === null ? (
        <nav className="flex items-center gap-3">
          <a
            href={loginUrl(returnTo)}
            className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white"
          >
            Sign in with GitHub
          </a>
          <a
            href={installUrl(returnTo)}
            className="text-sm font-medium text-muted underline"
          >
            Install OpenDraft
          </a>
        </nav>
      ) : (
        <nav className="flex items-center gap-3">
          <span className="text-sm font-medium text-inline-code">@{session.login}</span>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-md border border-outline px-3 py-1.5 text-sm font-medium text-black"
          >
            Sign out
          </button>
        </nav>
      )}
    </header>
  );
}
