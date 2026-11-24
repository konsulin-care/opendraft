/**
 * Sweep limits, delete failure isolation and post-delete verification tests.
 */
import { describe, expect, it } from 'vitest';
import type { SuggestionBranch, SuggestionPull } from '../github/bff-suggest';
import type { SweepDeps, SweepSource } from './cleanup-branches';
import { sweepBranches } from './cleanup-branches';

const SOURCE: SweepSource = {
  owner: 'konsulin',
  repo: 'opendraft',
  branch: 'od-octocat/current-draft',
};

interface FakeDeps {
  deps: SweepDeps;
  deleted: string[];
  heads: string[];
}

/**
 * Build sweep dependencies from mutable branch listings and pull lookups.
 *
 * @param branches - Branch listing responses keyed by prefix; deleted branches
 * are removed unless `keepListed` simulates an eventually consistent listing.
 * @param pulls - Pull request responses keyed by head ref.
 * @param failDelete - Optional branch name whose delete should throw.
 * @param keepListed - Keep deleted branches in listings to exercise verify.
 * @returns Fake dependencies and recorded calls.
 */
function fakeDeps(
  branches: Record<string, SuggestionBranch[]>,
  pulls: Record<string, SuggestionPull | null>,
  failDelete?: string,
  keepListed = false,
): FakeDeps {
  const deleted: string[] = [];
  const heads: string[] = [];
  const listing: Record<string, SuggestionBranch[]> = Object.fromEntries(
    Object.entries(branches).map(([prefix, entries]) => [prefix, [...entries]]),
  );

  return {
    deleted,
    heads,
    deps: {
      listSuggestionBranches: async (_owner, _repo, prefix) =>
        listing[prefix] ?? [],
      findSuggestionPull: async (_owner, _repo, head) => {
        heads.push(head);
        return pulls[head] ?? null;
      },
      deleteBranch: async (_owner, _repo, branch) => {
        if (branch === failDelete) {
          throw new Error('delete failed');
        }
        deleted.push(branch);

        if (!keepListed) {
          for (const [prefix, entries] of Object.entries(listing)) {
            listing[prefix] = entries.filter((entry) => entry.name !== branch);
          }
        }
      },
    },
  };
}

/** Build a closed pull request for a branch head ref. */
function closedPull(): SuggestionPull {
  return { number: 1, url: 'https://example.test/1', state: 'closed' };
}

describe('sweepBranches delete failures', () => {
  it('continues after a failed delete and reports that branch in skipped', async () => {
    const failing = 'od-octocat/failing';
    const working = 'od-octocat/working';
    const fake = fakeDeps(
      {
        'od-octocat/': [
          { name: failing, sha: 'sha-failing' },
          { name: working, sha: 'sha-working' },
        ],
      },
      {
        [`konsulin:${failing}`]: closedPull(),
        [`konsulin:${working}`]: closedPull(),
      },
      failing,
    );

    const result = await sweepBranches(SOURCE, 'octocat', fake.deps);

    expect(result.deleted).toEqual([working]);
    expect(result.skipped).toEqual([failing]);
    expect(fake.deleted).toEqual([working]);
  });
});

describe('sweepBranches limit option', () => {
  it('evaluates at most options.limit candidate branches per run', async () => {
    const branches = Array.from({ length: 10 }, (_, index) => ({
      name: `od-octocat/draft-${index}`,
      sha: `sha-${index}`,
    }));
    const fake = fakeDeps(
      { 'od-octocat/': branches },
      Object.fromEntries(
        branches.map((branch) => [
          `konsulin:${branch.name}`,
          { number: 1, url: 'https://example.test/1', state: 'open' as const },
        ]),
      ),
    );

    const result = await sweepBranches(SOURCE, 'octocat', fake.deps, {
      limit: 3,
    });

    expect(fake.heads).toEqual([
      'konsulin:od-octocat/draft-0',
      'konsulin:od-octocat/draft-1',
      'konsulin:od-octocat/draft-2',
    ]);
    expect(result.skipped).toHaveLength(3);
    expect(result.deleted).toEqual([]);
  });
});

describe('sweepBranches post-delete verification', () => {
  it('reports a branch that is still listed after its delete as skipped instead of deleted', async () => {
    const stale = 'od-octocat/stale';
    const fake = fakeDeps(
      { 'od-octocat/': [{ name: stale, sha: 'sha-stale' }] },
      { [`konsulin:${stale}`]: closedPull() },
      undefined,
      true,
    );

    const result = await sweepBranches(SOURCE, 'octocat', fake.deps);

    expect(fake.deleted).toEqual([stale]);
    expect(result).toEqual({ deleted: [], skipped: [stale] });
  });
});
