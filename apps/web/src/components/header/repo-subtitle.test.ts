import { describe, expect, it } from 'vitest';
import type { ProjectSource } from '@opendraft/workspace';
import { repoSubtitle } from './repo-subtitle';

/**
 * Build a GitHub project source with the given push target and upstream.
 *
 * @param owner - Push-target owner.
 * @param repo - Push-target repository name.
 * @param upstreamOwner - Upstream owner login.
 * @param upstreamRepo - Upstream repository name.
 * @returns A GitHub project source fixture.
 */
function githubSource(
  owner: string,
  repo: string,
  upstreamOwner: string,
  upstreamRepo: string,
): ProjectSource {
  return {
    kind: 'github',
    owner,
    repo,
    branch: 'main',
    upstream: { owner: upstreamOwner, repo: upstreamRepo, defaultBranch: 'main' },
    private: false,
    pushed: true,
    syncedSha: 'abc123',
    digest: {},
    pullNumber: null,
  };
}

describe('repoSubtitle', () => {
  it('labels a local project as only on this device', () => {
    expect(repoSubtitle({ kind: 'local' })).toBe('Only on this device');
  });

  it('labels an own repository as published at owner/repo', () => {
    expect(repoSubtitle(githubSource('konsulin', 'opendraft', 'konsulin', 'opendraft'))).toBe(
      'Published at konsulin/opendraft',
    );
  });

  it('matches the owner case-insensitively', () => {
    expect(repoSubtitle(githubSource('Konsulin', 'opendraft', 'konsulin', 'opendraft'))).toBe(
      'Published at Konsulin/opendraft',
    );
  });

  it('labels a fork with the upstream owner and repository', () => {
    expect(repoSubtitle(githubSource('octocat', 'opendraft', 'konsulin', 'opendraft'))).toBe(
      'Forked from konsulin/opendraft',
    );
  });
});
