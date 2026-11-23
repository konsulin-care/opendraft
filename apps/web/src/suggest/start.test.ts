/**
 * Suggestion start tests: local resume, remote branch resume and a fresh
 * fork-based suggestion.
 */
import { describe, expect, it, vi } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import type { ProjectRecord, ProjectSource, ProjectSourceGitHub } from '@opendraft/workspace';
import type { BffSession, RepoPermissions } from '../github/bff-client';
import { fileDigest } from './file-diff';
import { startSuggestion } from './start';
import type { ClonedSuggestion, StartSuggestionDeps } from './start';

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

const NOW = new Date(Date.UTC(2026, 0, 2, 3, 4, 5));
const BRANCH = 'opendraft/octocat/20260102-030405';

/** Build a project record with the given source. */
function record(id: string, source: ProjectSource): ProjectRecord {
  return { id, name: 'draft', source, createdAt: 1, lastOpenedAt: 1 };
}

/** A registry double that keeps records in memory. */
function makeRegistry(initial: ProjectRecord[] = []): {
  registry: StartSuggestionDeps['registry'];
  records: Map<string, ProjectRecord>;
} {
  const records = new Map(initial.map((project) => [project.id, project]));
  let next = 1;

  return {
    records,
    registry: {
      list: vi.fn(async () => [...records.values()]),
      create: vi.fn(async (name: string, source?: ProjectSourceGitHub) => {
        const created = record(`project-${next++}`, source ?? { kind: 'local' });
        const named = { ...created, name };
        records.set(named.id, named);
        return named;
      }),
      setSource: vi.fn(async (id: string, source: ProjectSourceGitHub) => {
        const existing = records.get(id);
        if (!existing) throw new Error(`missing ${id}`);
        const updated = { ...existing, source };
        records.set(id, updated);
        return updated;
      }),
    },
  };
}

/** Build the suggestion flow dependencies with inert defaults. */
function makeDeps(
  registry: StartSuggestionDeps['registry'],
  overrides: Partial<StartSuggestionDeps> = {},
): { deps: StartSuggestionDeps; workspace: MemoryWorkspace } {
  const workspace = new MemoryWorkspace();
  const deps: StartSuggestionDeps = {
    registry,
    getWorkspace: vi.fn(async () => workspace),
    forkRepo: vi.fn(async () => ({ owner: 'octocat', repo: 'draft', defaultBranch: 'main' })),
    syncFork: vi.fn(async () => undefined),
    listSuggestionBranches: vi.fn(async () => []),
    findSuggestionPull: vi.fn(async () => null),
    clone: vi.fn(async () => ({ sha: 'fresh-sha', files: new Map<string, string>() })),
    sleep: vi.fn(async () => undefined),
    now: vi.fn(() => NOW),
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

describe('startSuggestion local resume', () => {
  it('returns the existing local project for the same upstream without forking or cloning', async () => {
    const existing = record('local-project', {
      kind: 'github',
      owner: 'octocat',
      repo: 'draft',
      branch: BRANCH,
      upstream: { owner: 'OctoCat', repo: 'Draft', defaultBranch: 'main' },
      private: false,
      pushed: true,
      syncedSha: 'sha-1',
      digest: {},
      pullNumber: 12,
    });
    const { registry } = makeRegistry([existing]);
    const { deps } = makeDeps(registry);

    const result = await startSuggestion(
      { upstream: { owner: 'octocat', repo: 'draft' }, session: SESSION, plan: 'fork', access: ACCESS },
      deps,
    );

    expect(result).toEqual({ projectId: 'local-project', resumed: 'local' });
    expect(deps.forkRepo).not.toHaveBeenCalled();
    expect(deps.clone).not.toHaveBeenCalled();
  });
});

describe('startSuggestion remote resume', () => {
  it('clones the latest suggestion branch and stores pushed state and pull number', async () => {
    const branch = 'opendraft/octocat/20260103-120000';
    const files = new Map([
      ['opendraft.yml', 'protocol: v1\n'],
      ['manuscripts/paper/article.qmd', '# Paper\n'],
    ]);
    const cloned: ClonedSuggestion = { sha: 'remote-sha', files };
    const { registry, records } = makeRegistry();
    const { deps } = makeDeps(registry, {
      listSuggestionBranches: vi.fn(async () => [
        { name: 'opendraft/octocat/20260101-120000', sha: 'old' },
        { name: branch, sha: 'remote-sha' },
      ]),
      findSuggestionPull: vi.fn(async () => ({
        number: 17,
        url: 'https://github.com/octocat/draft/pull/17',
        state: 'open' as const,
      })),
      clone: vi.fn(async () => cloned),
    });

    const result = await startSuggestion(
      { upstream: { owner: 'octocat', repo: 'draft' }, session: SESSION, plan: 'branch', access: ACCESS },
      deps,
    );

    expect(result.resumed).toBe('remote');
    expect(deps.listSuggestionBranches).toHaveBeenCalledWith('octocat', 'draft', 'opendraft/octocat/');
    expect(deps.findSuggestionPull).toHaveBeenCalledWith('octocat', 'draft', `octocat:${branch}`);
    expect(deps.clone).toHaveBeenCalledWith('octocat', 'draft', branch);
    expect(deps.forkRepo).not.toHaveBeenCalled();
    expect(deps.syncFork).not.toHaveBeenCalled();

    expectSource(records, result.projectId, {
      kind: 'github',
      owner: 'octocat',
      repo: 'draft',
      branch,
      upstream: { owner: 'octocat', repo: 'draft' },
      pushed: true,
      syncedSha: 'remote-sha',
      pullNumber: 17,
      private: false,
    }, fileDigest(files));
  });
});

describe('startSuggestion fresh fork', () => {
  it('forks, syncs, clones only scoped files and creates a new suggestion branch', async () => {
    const files = new Map([
      ['README.md', '# Draft\n'],
      ['opendraft.yml', 'protocol: v1\n'],
      ['manuscripts/paper/article.qmd', '# Paper\n'],
      ['manuscripts/paper/_author.yml', 'authors: []\n'],
    ]);
    const { registry, records } = makeRegistry();
    const { deps, workspace } = makeDeps(registry, {
      forkRepo: vi.fn(async () => ({ owner: 'octocat', repo: 'draft', defaultBranch: 'trunk' })),
      clone: vi.fn(async () => ({ sha: 'fork-sha', files })),
    });

    const result = await startSuggestion(
      { upstream: { owner: 'octocat', repo: 'draft' }, session: SESSION, plan: 'fork', access: ACCESS },
      deps,
    );

    expect(result.resumed).toBe('fresh');
    expect(deps.forkRepo).toHaveBeenCalledWith('octocat', 'draft');
    expect(deps.syncFork).toHaveBeenCalledWith('octocat', 'draft', 'trunk');
    expect(deps.clone).toHaveBeenCalledWith('octocat', 'draft');
    expect(deps.now).toHaveBeenCalled();

    await expect(workspace.listAll()).resolves.toEqual([
      'manuscripts/paper/_author.yml',
      'manuscripts/paper/article.qmd',
      'opendraft.yml',
    ]);

    expectSource(records, result.projectId, {
      kind: 'github',
      owner: 'octocat',
      repo: 'draft',
      branch: BRANCH,
      upstream: { owner: 'octocat', repo: 'draft', defaultBranch: 'trunk' },
      pushed: false,
      syncedSha: 'fork-sha',
      pullNumber: null,
      private: false,
    }, fileDigest(files));
  });
});
