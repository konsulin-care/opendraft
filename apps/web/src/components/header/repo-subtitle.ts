import type { ProjectSource } from '@opendraft/workspace';

/** Parts of the header subtitle: a plain prefix and an optional linked repo. */
export interface RepoSubtitleParts {
  /** Plain-language location label, e.g. "Forked from". */
  prefix: string;
  /** Repository in `owner/repo` form; absent for local projects. */
  repo?: string;
  /** GitHub URL of the repository; absent for local projects. */
  href?: string;
}

/**
 * Build the GitHub URL for a repository.
 *
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @returns The repository's GitHub URL.
 */
function githubUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}`;
}

/**
 * Plain-language subtitle describing where a project lives.
 *
 * Local projects are device-only, a GitHub project whose push target is the
 * upstream repository is published there, and everything else is a fork of
 * its upstream repository. Owners compare case-insensitively because GitHub
 * logins are case-insensitive.
 *
 * @param source - The project's source descriptor.
 * @returns The subtitle parts for the header's second line.
 */
export function repoSubtitle(source: ProjectSource): RepoSubtitleParts {
  if (source.kind === 'local') return { prefix: 'Only on this device' };

  const sameOwner = source.owner.toLowerCase() === source.upstream.owner.toLowerCase();
  if (sameOwner) {
    return {
      prefix: 'Published at',
      repo: `${source.owner}/${source.repo}`,
      href: githubUrl(source.owner, source.repo),
    };
  }

  return {
    prefix: 'Forked from',
    repo: `${source.upstream.owner}/${source.upstream.repo}`,
    href: githubUrl(source.upstream.owner, source.upstream.repo),
  };
}
