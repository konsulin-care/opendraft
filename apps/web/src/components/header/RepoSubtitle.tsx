import { SquareArrowUpRightExit } from 'lucide-react';

/** Props for {@link RepoSubtitle}. */
export interface RepoSubtitleProps {
  /** Plain-language lead-in, for example "Published at". */
  prefix: string;
  /** Repository slug shown as the clickable part, for example "owner/repo". */
  repo?: string;
  /** External URL the repository slug links to. */
  href?: string;
}

/** Link styling for the repository slug. */
const REPO_LINK =
  'inline-flex min-w-0 items-center gap-0.5 text-black underline decoration-dashed underline-offset-2';

/**
 * Header subtitle naming where a project lives.
 *
 * The prefix stays plain text in its own element and only the repository slug
 * becomes an external link, so local projects render without any link. The
 * repo text truncates while the trailing external-link icon keeps its size.
 *
 * @param props - See {@link RepoSubtitleProps}.
 * @returns The subtitle content for the header's second line.
 */
export function RepoSubtitle({ prefix, repo, href }: RepoSubtitleProps) {
  if (repo === undefined || href === undefined) {
    return (
      <>
        <span>{prefix}</span>
        {repo !== undefined && <> {repo}</>}
      </>
    );
  }

  return (
    <>
      <span>{prefix}</span>{' '}
      <a className={REPO_LINK} href={href} target="_blank" rel="noopener noreferrer">
        <span className="min-w-0 truncate">{repo}</span>
        <SquareArrowUpRightExit className="size-3 shrink-0" aria-hidden="true" />
      </a>
    </>
  );
}
