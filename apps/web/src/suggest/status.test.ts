/**
 * Suggestion status tests: local-only, branch lifecycle, remote movement and
 * pull request states reported from the remote.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ProjectSourceGitHub } from '@opendraft/workspace';
import type { SuggestionPull } from '../github/bff-suggest';
import { checkSuggestion } from './status';
import type { CheckSuggestionDeps } from './status';

const BRANCH = 'opendraft/octocat/20260102-030405';
const PR_URL = 'https://github.com/konsulin-care/draft/pull/7';

/** Build a pushed GitHub project source for the status tests. */
function source(overrides: Partial<ProjectSourceGitHub> = {}): ProjectSourceGitHub {
  return {
    kind: 'github',
    owner: 'octocat',
    repo: 'draft',
    branch: BRANCH,
    upstream: { owner: 'konsulin-care', repo: 'draft', defaultBranch: 'main' },
    private: false,
    pushed: true,
    syncedSha: 'sync-sha',
    digest: {},
    pullNumber: null,
    ...overrides,
  };
}

/** Build status dependencies with inert GitHub doubles. */
function makeDeps(overrides: Partial<CheckSuggestionDeps> = {}): CheckSuggestionDeps {
  return {
    listSuggestionBranches: vi.fn(async () => [{ name: BRANCH, sha: 'sync-sha' }]),
    findSuggestionPull: vi.fn(async () => null),
    ...overrides,
  };
}

/** Build an open pull request fixture. */
function pull(overrides: Partial<SuggestionPull> = {}): SuggestionPull {
  return { number: 7, url: PR_URL, state: 'open', ...overrides };
}

describe('checkSuggestion local-only', () => {
  it('reports local-only without touching the remote when the branch was never pushed', async () => {
    const deps = makeDeps();

    const result = await checkSuggestion(source({ pushed: false }), deps);

    expect(result).toEqual({ state: 'local-only' });
    expect(deps.listSuggestionBranches).not.toHaveBeenCalled();
    expect(deps.findSuggestionPull).not.toHaveBeenCalled();
  });
});

describe('checkSuggestion branch lifecycle', () => {
  it('reports branch-deleted when the pushed branch is missing remotely', async () => {
    const deps = makeDeps({ listSuggestionBranches: vi.fn(async () => []) });

    const result = await checkSuggestion(source(), deps);

    expect(result).toEqual({ state: 'branch-deleted' });
    expect(deps.listSuggestionBranches).toHaveBeenCalledWith(
      'octocat',
      'draft',
      'opendraft/octocat/',
    );
    expect(deps.findSuggestionPull).not.toHaveBeenCalled();
  });

  it('reports remote-moved when the branch head differs from the synced commit', async () => {
    const deps = makeDeps({
      listSuggestionBranches: vi.fn(async () => [{ name: BRANCH, sha: 'remote-sha' }]),
    });

    const result = await checkSuggestion(source(), deps);

    expect(result).toEqual({ state: 'remote-moved' });
    expect(deps.findSuggestionPull).not.toHaveBeenCalled();
  });
});

describe('checkSuggestion pull request state', () => {
  it('reports draft when the pushed branch has no pull request', async () => {
    const deps = makeDeps();

    const result = await checkSuggestion(source(), deps);

    expect(result).toEqual({ state: 'draft' });
    expect(deps.findSuggestionPull).toHaveBeenCalledWith(
      'konsulin-care',
      'draft',
      `octocat:${BRANCH}`,
    );
  });

  it('reports an open pull request with its number and url', async () => {
    const deps = makeDeps({ findSuggestionPull: vi.fn(async () => pull()) });

    const result = await checkSuggestion(source({ pullNumber: 7 }), deps);

    expect(result).toEqual({ state: 'open', number: 7, url: PR_URL });
  });

  it('reports revision-needed when the open pull request requests changes', async () => {
    const deps = makeDeps({
      findSuggestionPull: vi.fn(async () => pull({ reviewState: 'changes_requested' })),
    });

    const result = await checkSuggestion(source({ pullNumber: 7 }), deps);

    expect(result).toEqual({ state: 'revision-needed', number: 7, url: PR_URL });
  });

  it('keeps an open pull request open when its latest review approves', async () => {
    const deps = makeDeps({
      findSuggestionPull: vi.fn(async () => pull({ reviewState: 'approved' })),
    });

    const result = await checkSuggestion(source({ pullNumber: 7 }), deps);

    expect(result).toEqual({ state: 'open', number: 7, url: PR_URL });
  });
});

describe('checkSuggestion closed pull request state', () => {
  it('reports a merged pull request with its number and url', async () => {
    const deps = makeDeps({
      findSuggestionPull: vi.fn(async () => pull({ state: 'merged' as const })),
    });

    const result = await checkSuggestion(source(), deps);

    expect(result).toEqual({ state: 'merged', number: 7, url: PR_URL });
  });

  it('reports a closed pull request with its number and url', async () => {
    const deps = makeDeps({
      findSuggestionPull: vi.fn(async () => pull({ state: 'closed' as const })),
    });

    const result = await checkSuggestion(source(), deps);

    expect(result).toEqual({ state: 'closed', number: 7, url: PR_URL });
  });

  it('qualifies the head with the owner even when the branch lives on the upstream', async () => {
    const deps = makeDeps({ findSuggestionPull: vi.fn(async () => pull()) });

    await checkSuggestion(
      source({ owner: 'konsulin-care', branch: 'opendraft/octocat/20260102-030405' }),
      deps,
    );

    expect(deps.findSuggestionPull).toHaveBeenCalledWith(
      'konsulin-care',
      'draft',
      'konsulin-care:opendraft/octocat/20260102-030405',
    );
  });
});
