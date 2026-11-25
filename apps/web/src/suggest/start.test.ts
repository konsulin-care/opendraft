/**
 * Suggestion start tests: local resume, persistent-repo draft creation,
 * owner-only remote resumption and best-effort fork sync.
 */
import { describe, expect, it, vi } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import type { ProjectRecord, ProjectSource, ProjectSourceGitHub } from '@opendraft/workspace';
import type { BffSession, RepoPermissions } from '../github/bff-client';
import { fileDigest } from './file-diff';
import { startSuggestion } from './start';
import type { StartSuggestionDeps } from './start';

const SESSION: BffSession = {
  login: 'octocat',
  id: 42,
  name: 'Mona Lisa',
  expiresAt: '2026-01-01T00:00:00Z',
};
const ACCESS: RepoPermissions = {
  push: false,
  installed: true,
  defaultBranch: 'main',
  private: false,
  allowForking: true,
  viewerInstalledAll: true,
};
const UPSTREAM = { owner: 'octocat', repo: 'draft' };
const PLACEHOLDER_BRANCH = 'od-octocat/untitled-draft';

/** Build a project record with the given source. */
function record(id: string, source: ProjectSource): ProjectRecord {
  return { id, name: 'draft', source, createdAt: 1, lastOpenedAt: 1 };
}

/** A registry double that keeps records in memory. */
function makeRegistry(initial: ProjectRecord[] = []) {
  const records = new Map(initial.map((project) => [project.id, project]));
  let next = 1;
  const registry: StartSuggestionDeps['registry'] = {
    list: vi.fn(async () => [...records.values()]),
    create: vi.fn(async (name: string, source?: ProjectSourceGitHub) => {
      const created = { ...record(`project-${next++}`, source ?? { kind: 'local' }), name };
      records.set(created.id, created);
      return created;
    }),
    setSource: vi.fn(async (id: string, source: ProjectSourceGitHub) => {
      const updated = { ...records.get(id)!, source };
      records.set(id, updated);
      return updated;
    }),
  };
  return { registry, records };
}

/** Build the suggestion flow dependencies with inert defaults. */
function makeDeps(
  registry: StartSuggestionDeps['registry'],
  overrides: Partial<StartSuggestionDeps> = {},
) {
  const workspace = new MemoryWorkspace();
  const deps: StartSuggestionDeps = {
    registry,
    getWorkspace: vi.fn(async () => workspace),
    forkRepo: vi.fn(async () => ({ owner: 'octocat', repo: 'draft', defaultBranch: 'main' })),
    syncFork: vi.fn(async () => undefined),
    listSuggestionBranches: vi.fn(async () => []),
    findSuggestionPull: vi.fn(async () => null),
    prepareRepo: vi.fn(async (_project: ProjectRecord, branch: string) => ({
      sha: 'prepared-sha',
      branch,
      files: new Map<string, string>(),
    })),
    ...overrides,
  };
  return { deps, workspace };
}

/** Assert the stored source and digest of a project. */
function expectSource(
  records: Map<string, ProjectRecord>,
  projectId: string,
  expected: Record<string, unknown>,
  digest: Record<string, string>,
): void {
  const source = records.get(projectId)?.source;
  expect(source).toMatchObject(expected);
  expect(source?.kind === 'github' ? source.digest : null).toEqual(digest);
}

/** Build the start input for the test upstream. */
function startInput(plan: 'branch' | 'fork' = 'branch') {
  return { upstream: UPSTREAM, session: SESSION, plan, access: ACCESS };
}

describe('startSuggestion local resume', () => {
  it('returns the existing project without forking or preparing', async () => {
    const existing = record('local-project', {
      kind: 'github',
      owner: 'octocat',
      repo: 'draft',
      branch: 'od-octocat/old-draft',
      upstream: { owner: 'OctoCat', repo: 'Draft', defaultBranch: 'main' },
      private: false,
      pushed: true,
      syncedSha: 'sha-1',
      digest: {},
      pullNumber: 12,
    });
    const { registry } = makeRegistry([existing]);
    const { deps } = makeDeps(registry);

    const result = await startSuggestion(startInput('fork'), deps);

    expect(result).toEqual({ projectId: 'local-project', resumed: 'local' });
    expect(deps.forkRepo).not.toHaveBeenCalled();
    expect(deps.prepareRepo).not.toHaveBeenCalled();
  });
});

describe('startSuggestion fresh draft', () => {
  it('clones into the project repo on od-<login>/untitled-draft with pushed=false', async () => {
    const files = new Map([
      ['README.md', '# Draft\n'],
      ['opendraft.yml', 'protocol: v1\n'],
      ['manuscripts/paper/article.qmd', '# Paper\n'],
    ]);
    const { registry, records } = makeRegistry();
    const { deps, workspace } = makeDeps(registry, {
      prepareRepo: vi.fn(async (_project: ProjectRecord, branch: string) => ({
        sha: 'default-sha',
        branch,
        files,
      })),
    });

    const result = await startSuggestion(startInput(), deps);

    expect(result.resumed).toBe('fresh');
    const [project, branch, createBranch, session] = vi
      .mocked(deps.prepareRepo).mock.calls[0];
    expect(project.source).toMatchObject({
      kind: 'github', owner: 'octocat', repo: 'draft', branch: PLACEHOLDER_BRANCH,
      upstream: { ...UPSTREAM, defaultBranch: 'main' }, pushed: false,
      pullNumber: null, private: false,
    });
    expect([branch, createBranch, session]).toEqual([PLACEHOLDER_BRANCH, true, SESSION]);
    expect(deps.listSuggestionBranches).toHaveBeenCalledWith('octocat', 'draft', 'od-octocat/');
    expect(deps.listSuggestionBranches).toHaveBeenCalledWith('octocat', 'draft', 'opendraft/octocat/');
    await expect(workspace.listAll()).resolves.toEqual([
      'manuscripts/paper/article.qmd', 'opendraft.yml',
    ]);
    expectSource(records, result.projectId, {
      kind: 'github', owner: 'octocat', repo: 'draft', branch: PLACEHOLDER_BRANCH,
      upstream: { ...UPSTREAM, defaultBranch: 'main' }, pushed: false,
      syncedSha: 'default-sha', pullNumber: null, private: false,
    }, fileDigest(files));
  });
});

describe('startSuggestion remote resume', () => {
  const own = 'od-octocat/my-draft';
  const files = new Map([['opendraft.yml', 'protocol: v1\n']]);

  it('picks the viewer own od-<login>/ branch and ignores other collaborators', async () => {
    const { registry, records } = makeRegistry();
    const { deps } = makeDeps(registry, {
      listSuggestionBranches: vi.fn(async (_owner: string, _repo: string, prefix: string) =>
        prefix === 'od-octocat/'
          ? [
              { name: 'od-other/their-draft', sha: 'other' },
              { name: 'od-octocat2/not-mine', sha: 'near' },
              { name: own, sha: 'own' },
            ]
          : [{ name: 'opendraft/octocat/20250102-030405', sha: 'legacy' }],
      ),
      findSuggestionPull: vi.fn(async () => ({
        number: 17, url: 'https://github.com/octocat/draft/pull/17', state: 'open' as const,
      })),
      prepareRepo: vi.fn(async (_project: ProjectRecord, branch: string) => ({
        sha: 'remote-sha', branch, files,
      })),
    });

    const result = await startSuggestion(startInput(), deps);

    expect(result.resumed).toBe('remote');
    expect(deps.findSuggestionPull).toHaveBeenCalledWith('octocat', 'draft', `octocat:${own}`);
    const [project, branch, createBranch] = vi.mocked(deps.prepareRepo).mock.calls[0];
    expect(project.source).toMatchObject({ branch: own, pushed: true, pullNumber: 17 });
    expect([branch, createBranch]).toEqual([own, false]);
    expectSource(records, result.projectId, {
      kind: 'github', owner: 'octocat', repo: 'draft', branch: own,
      upstream: UPSTREAM, pushed: true, syncedSha: 'remote-sha', pullNumber: 17,
      private: false,
    }, fileDigest(files));
  });
});

describe('startSuggestion legacy resume', () => {
  it('resumes a legacy opendraft/<login>/ branch when no new draft exists', async () => {
    const legacy = 'opendraft/octocat/20250102-030405';
    const { registry } = makeRegistry();
    const { deps } = makeDeps(registry, {
      listSuggestionBranches: vi.fn(
        async (_owner: string, _repo: string, prefix: string) =>
          prefix === 'opendraft/octocat/' ? [{ name: legacy, sha: 'legacy' }] : [],
      ),
    });

    const result = await startSuggestion(startInput(), deps);

    expect(result.resumed).toBe('remote');
    expect(deps.prepareRepo).toHaveBeenCalledWith(expect.anything(), legacy, false, SESSION);
  });
});

describe('startSuggestion fresh fork', () => {
  it('syncs the fork before creating the draft in the persistent repo', async () => {
    const { registry } = makeRegistry();
    const syncFork = vi.fn(async () => undefined);
    const { deps } = makeDeps(registry, {
      forkRepo: vi.fn(async () => ({ owner: 'octocat', repo: 'draft', defaultBranch: 'trunk' })),
      syncFork,
    });

    const result = await startSuggestion(
      { ...startInput('fork'), upstream: { owner: 'konsulin-care', repo: 'draft' } },
      deps,
    );

    expect(result.resumed).toBe('fresh');
    expect(deps.forkRepo).toHaveBeenCalledWith('konsulin-care', 'draft');
    expect(syncFork).toHaveBeenCalledWith('octocat', 'draft', 'trunk');
    expect(syncFork.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(deps.prepareRepo).mock.invocationCallOrder[0],
    );
    expect(deps.prepareRepo).toHaveBeenCalledWith(
      expect.objectContaining({
        source: expect.objectContaining({
          owner: 'octocat', branch: PLACEHOLDER_BRANCH, pushed: false,
          upstream: { owner: 'konsulin-care', repo: 'draft', defaultBranch: 'trunk' },
        }),
      }),
      PLACEHOLDER_BRANCH, true, SESSION,
    );
  });
});
