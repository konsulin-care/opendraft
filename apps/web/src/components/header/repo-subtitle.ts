import type { ProjectSource } from '@opendraft/workspace';

/**
 * Plain-language subtitle describing where a project lives.
 *
 * Local projects are device-only, a GitHub project whose push target is the
 * upstream repository is published there, and everything else is a fork of
 * its upstream repository. Owners compare case-insensitively because GitHub
 * logins are case-insensitive.
 *
 * @param source - The project's source descriptor.
 * @returns The subtitle text for the header's second line.
 */
export function repoSubtitle(source: ProjectSource): string {
  if (source.kind === 'local') return 'Only on this device';

  const sameOwner = source.owner.toLowerCase() === source.upstream.owner.toLowerCase();
  if (sameOwner) return `Published at ${source.owner}/${source.repo}`;

  return `Forked from ${source.upstream.owner}/${source.upstream.repo}`;
}
