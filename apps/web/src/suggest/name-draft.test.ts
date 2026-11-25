/**
 * Draft naming tests: availability against remote refs and the local branch
 * rename that records the chosen name in the project source.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ProjectRecord, ProjectSourceGitHub } from '@opendraft/workspace';
import { applyDraftName, checkDraftName } from './name-draft';
import type { ApplyDraftNameDeps } from './name-draft';

/** Build an unpushed GitHub source for the tests. */
function githubSource(
  overrides: Partial<ProjectSourceGitHub> = {},
): ProjectSourceGitHub {
  return {
    kind: 'github',
    owner: 'octocat',
    repo: 'draft',
    branch: 'od-octocat/untitled-draft',
    upstream: { owner: 'konsulin-care', repo: 'draft', defaultBranch: 'main' },
    private: false,
    pushed: false,
    syncedSha: 'base-sha',
    digest: {},
    pullNumber: null,
    ...overrides,
  };
}

/** Build a project record with a GitHub source. */
function project(source: ProjectSourceGitHub = githubSource()): ProjectRecord {
  return {
    id: 'project-1',
    name: 'draft',
    source,
    createdAt: 1,
    lastOpenedAt: 1,
  };
}

/** Build fake apply dependencies around one project. */
function applyDeps(source: ProjectSourceGitHub = githubSource()) {
  const renameBranch = vi.fn(async () => undefined);
  const setSource = vi.fn(async (id: string, next: ProjectSourceGitHub) => ({
    id,
    source: next,
  }));
  const deps: ApplyDraftNameDeps = {
    registry: {
      get: vi.fn(async () => project(source)),
      setSource,
    },
    repo: { renameBranch },
    login: 'OctoCat',
  };
  return { deps, renameBranch, setSource };
}

describe('checkDraftName', () => {
  it('lists refs under od-<login> and reports free when the slug is unused', async () => {
    const listRefs = vi.fn(async () => [
      { name: 'main' },
      { name: 'od-other/fix-typos' },
    ]);

    const status = await checkDraftName(
      { owner: 'konsulin-care', repo: 'draft', login: 'OctoCat', name: 'Fix typos' },
      { listRefs },
    );

    expect(listRefs).toHaveBeenCalledWith(
      'konsulin-care',
      'draft',
      'od-octocat',
    );
    expect(status).toEqual({ kind: 'free' });
  });

  it('reports taken with the next free alternative', async () => {
    const listRefs = vi.fn(async () => [
      { name: 'od-octocat/fix-typos' },
      { name: 'od-octocat/fix-typos-2' },
    ]);

    const status = await checkDraftName(
      { owner: 'octocat', repo: 'draft', login: 'octocat', name: 'Fix typos' },
      { listRefs },
    );

    expect(status).toEqual({ kind: 'taken', alternative: 'fix-typos-3' });
  });

  it('reports blocked when a branch is named exactly od-<login>', async () => {
    const listRefs = vi.fn(async () => [
      { name: 'main' },
      { name: 'od-octocat' },
    ]);

    const status = await checkDraftName(
      { owner: 'octocat', repo: 'draft', login: 'octocat', name: 'Fix typos' },
      { listRefs },
    );

    expect(status).toEqual({ kind: 'blocked' });
  });
});

describe('applyDraftName', () => {
  it('renames the unpushed local branch and updates source.branch', async () => {
    const { deps, renameBranch, setSource } = applyDeps();

    const branch = await applyDraftName('project-1', 'Fix typos', deps);

    expect(branch).toBe('od-octocat/fix-typos');
    expect(renameBranch).toHaveBeenCalledWith(
      'od-octocat/untitled-draft',
      'od-octocat/fix-typos',
    );
    expect(setSource).toHaveBeenCalledWith('project-1', {
      ...githubSource(),
      branch: 'od-octocat/fix-typos',
    });
  });

  it('rejects when the draft was already pushed', async () => {
    const { deps, renameBranch, setSource } = applyDeps(
      githubSource({ pushed: true, branch: 'od-octocat/untitled-draft' }),
    );

    await expect(
      applyDraftName('project-1', 'Fix typos', deps),
    ).rejects.toThrow(/already pushed/);
    expect(renameBranch).not.toHaveBeenCalled();
    expect(setSource).not.toHaveBeenCalled();
  });

  it('rejects when the project is not a GitHub project', async () => {
    const deps: ApplyDraftNameDeps = {
      registry: {
        get: vi.fn(async () => ({
          ...project(),
          source: { kind: 'local' as const },
        })),
        setSource: vi.fn(),
      },
      repo: { renameBranch: vi.fn() },
      login: 'octocat',
    };

    await expect(
      applyDraftName('project-1', 'Fix typos', deps),
    ).rejects.toThrow(/not a GitHub project/);
  });
});
