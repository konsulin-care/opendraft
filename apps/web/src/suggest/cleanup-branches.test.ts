/**
 * Stale suggestion branch sweep tests.
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
  deleted: Array<{ owner: string; repo: string; branch: string }>;
  heads: string[];
  prefixes: string[];
}

/**
 * Build sweep dependencies from branch listings and pull request lookups.
 *
 * @param branches - Branch listing responses keyed by prefix.
 * @param pulls - Pull request responses keyed by head ref.
 * @returns Fake dependencies and recorded calls.
 */
function fakeDeps(
  branches: Record<string, SuggestionBranch[]>,
  pulls: Record<string, SuggestionPull | null>,
): FakeDeps {
  const deleted: FakeDeps['deleted'] = [];
  const heads: string[] = [];
  const prefixes: string[] = [];
  const listing: Record<string, SuggestionBranch[]> = Object.fromEntries(
    Object.entries(branches).map(([prefix, entries]) => [prefix, [...entries]]),
  );

  return {
    deleted,
    heads,
    prefixes,
    deps: {
      listSuggestionBranches: async (_owner, _repo, prefix) => {
        const found = listing[prefix] ?? [];
        if (found.length > 0 && !prefixes.includes(prefix)) {
          prefixes.push(prefix);
        }
        return found;
      },
      findSuggestionPull: async (_owner, _repo, head) => {
        heads.push(head);
        return pulls[head] ?? null;
      },
      deleteBranch: async (owner, repo, branch) => {
        deleted.push({ owner, repo, branch });
        for (const [prefix, entries] of Object.entries(listing)) {
          listing[prefix] = entries.filter((entry) => entry.name !== branch);
        }
      },
    },
  };
}

describe('sweepBranches closed pull requests', () => {
  it('deletes own branches under od-<login>/ and opendraft/<login>/ whose latest pull request is closed', async () => {
    const draft = 'od-octocat/old-draft';
    const legacy = 'opendraft/octocat/20250101-120000';
    const fake = fakeDeps(
      {
        'od-octocat/': [{ name: draft, sha: 'sha-draft' }],
        'opendraft/octocat/': [{ name: legacy, sha: 'sha-legacy' }],
      },
      {
        'konsulin:od-octocat/old-draft': {
          number: 1,
          url: 'https://example.test/1',
          state: 'closed',
        },
        'konsulin:opendraft/octocat/20250101-120000': {
          number: 2,
          url: 'https://example.test/2',
          state: 'closed',
        },
      },
    );

    const result = await sweepBranches(SOURCE, 'octocat', fake.deps);

    expect(result).toEqual({ deleted: [draft, legacy], skipped: [] });
    expect(fake.deleted).toEqual([
      { owner: 'konsulin', repo: 'opendraft', branch: draft },
      { owner: 'konsulin', repo: 'opendraft', branch: legacy },
    ]);
    expect(fake.prefixes).toEqual(['od-octocat/', 'opendraft/octocat/']);
  });
});

describe('sweepBranches merged pull requests', () => {
  it('deletes a branch with a merged pull request only when the branch head sha equals the pull request headSha', async () => {
    const same = 'od-octocat/merged-same';
    const moved = 'od-octocat/merged-moved';
    const missing = 'od-octocat/merged-missing';
    const fake = fakeDeps(
      {
        'od-octocat/': [
          { name: same, sha: 'sha-same' },
          { name: moved, sha: 'sha-new' },
          { name: missing, sha: 'sha-missing' },
        ],
      },
      {
        'konsulin:od-octocat/merged-same': {
          number: 1,
          url: 'https://example.test/1',
          state: 'merged',
          headSha: 'sha-same',
        },
        'konsulin:od-octocat/merged-moved': {
          number: 2,
          url: 'https://example.test/2',
          state: 'merged',
          headSha: 'sha-old',
        },
        'konsulin:od-octocat/merged-missing': {
          number: 3,
          url: 'https://example.test/3',
          state: 'merged',
        },
      },
    );

    const result = await sweepBranches(SOURCE, 'octocat', fake.deps);

    expect(result).toEqual({ deleted: [same], skipped: [moved, missing] });
  });
});

describe('sweepBranches protected branches', () => {
  it('keeps the current branch, branches with an open pull request and branches without a pull request', async () => {
    const current = SOURCE.branch;
    const open = 'od-octocat/open-draft';
    const none = 'od-octocat/no-pull';
    const fake = fakeDeps(
      {
        'od-octocat/': [
          { name: current, sha: 'sha-current' },
          { name: open, sha: 'sha-open' },
          { name: none, sha: 'sha-none' },
        ],
      },
      {
        'konsulin:od-octocat/current-draft': {
          number: 1,
          url: 'https://example.test/1',
          state: 'closed',
        },
        'konsulin:od-octocat/open-draft': {
          number: 2,
          url: 'https://example.test/2',
          state: 'open',
        },
      },
    );

    const result = await sweepBranches(SOURCE, 'octocat', fake.deps);

    expect(result).toEqual({ deleted: [], skipped: [current, open, none] });
    expect(fake.deleted).toEqual([]);
    expect(fake.heads).toEqual([
      'konsulin:od-octocat/open-draft',
      'konsulin:od-octocat/no-pull',
    ]);
  });
});

describe('sweepBranches candidate cap', () => {
  it('looks up pull requests with the repository-qualified head and caps candidates at 20', async () => {
    const branches = Array.from({ length: 25 }, (_, index) => ({
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

    const result = await sweepBranches(SOURCE, 'octocat', fake.deps);

    expect(fake.heads).toHaveLength(20);
    expect(fake.heads[0]).toBe('konsulin:od-octocat/draft-0');
    expect(result.skipped).toHaveLength(20);
    expect(result.deleted).toEqual([]);
  });
});
