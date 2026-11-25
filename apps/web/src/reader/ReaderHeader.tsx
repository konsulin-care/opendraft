/**
 * Reader header built on the shared two-line header shell.
 *
 * The leading book mark links back to the editor, the first line carries the
 * selected manuscript title and its switcher, and the second line names the
 * published repository. The main reader action sits before the account menu.
 */

import type { ReactNode } from 'react';
import { BookOpenText } from 'lucide-react';
import type { BffSession } from '../github/bff-client';
import { HeaderShell } from '../components/header/HeaderShell';
import { ManuscriptSwitcher } from '../components/header/ManuscriptSwitcher';
import type { ManuscriptSwitcherOption } from '../components/header/ManuscriptSwitcher';
import { RepoSubtitle } from '../components/header/RepoSubtitle';
import { UserMenu } from '../components/header/UserMenu';

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
  /** Selected manuscript title; defaults to "All manuscripts". */
  title?: string;
  /** Manuscripts offered by the switcher. */
  manuscripts?: readonly ManuscriptSwitcherOption[];
  /** Id of the manuscript currently open. */
  selectedId?: string;
  /** Called with the id of the manuscript chosen in the switcher. */
  onSelect?: (id: string) => void;
  /** When given, adds an "All manuscripts" entry to the switcher. */
  onSelectAll?: () => void;
  /** Main reader action, shown before the account menu. */
  action?: ReactNode;
}

const ICON_LINK =
  'inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500';

/**
 * Render the reader header with title, switcher, action and account menu.
 *
 * @param props - See {@link ReaderHeaderProps}.
 * @returns The shared header shell configured for the reader.
 */
export function ReaderHeader({
  session,
  returnTo,
  onLogout,
  loginEnabled = true,
  title,
  manuscripts = [],
  selectedId,
  onSelect,
  onSelectAll,
  action,
}: ReaderHeaderProps) {
  const heading = title ?? 'All manuscripts';
  const repo = readerRepoName(returnTo);

  return (
    <HeaderShell
      leading={
        <a href="/" aria-label="Open editor" title="Open editor" className={ICON_LINK}>
          <BookOpenText className="h-5 w-5" aria-hidden="true" />
        </a>
      }
      title={
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate text-sm font-semibold text-gray-900">{heading}</span>
          {onSelect !== undefined && manuscripts.length > 1 ? (
            <ManuscriptSwitcher
              manuscripts={manuscripts}
              currentId={selectedId}
              onSelect={onSelect}
              onSelectAll={onSelectAll}
            />
          ) : null}
        </span>
      }
      subtitle={<PublishedSubtitle repo={repo} />}
      action={action}
      userMenu={
        <UserMenu
          session={session}
          returnTo={returnTo}
          onLogout={onLogout}
          loginEnabled={loginEnabled}
        />
      }
    />
  );
}

/**
 * Render the `Published at` subtitle for an optional repository slug.
 *
 * @param props - The repository slug, or an empty string for a local project.
 * @returns A plain prefix for local projects, otherwise a linked repository.
 */
function PublishedSubtitle({ repo }: { repo: string }) {
  if (repo === '') return <RepoSubtitle prefix="Published at" />;
  return (
    <RepoSubtitle prefix="Published at" repo={repo} href={`https://github.com/${repo}`} />
  );
}

/**
 * Extract `owner/repo` from a reader path.
 *
 * @param path - Reader path such as `/{owner}/{repo}[/tree/{ref}]`.
 * @returns The repository name, or the trimmed path when it has no owner.
 */
function readerRepoName(path: string): string {
  const [owner = '', repo = ''] = path.split('?')[0].split('/').filter(Boolean);
  return repo === '' ? owner : `${owner}/${repo}`;
}

export default ReaderHeader;
