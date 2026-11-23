/**
 * Restart and pull-latest tests: replacing scoped workspace files from the
 * default branch or the suggestion branch and resetting the stored sync state.
 */
import { describe, expect, it, vi } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import type { ProjectRecord, ProjectSourceGitHub } from '@opendraft/workspace';
import type { BffSession } from '../github/bff-client';
import { fileDigest } from './file-diff';
import { pullLatest, restartSuggestion } from './restart';
import type { RestartDeps } from './restart';

const SESSION: BffSession = {
  login: 'octocat',
  id: 42,
  name: 'Mona Lisa',
  expiresAt: '2026-01-01T00:00:00Z',
};

const OLD_BRANCH = 'opendraft/octocat/20260102-030405';
const NEW_BRANCH = 'opendraft/octocat/20260203-040506';
const NOW = new Date(Date.UTC(2026, 1, 3, 4, 5, 6));

/** Build a pushed GitHub project source for the restart tests. */
function source(overrides: Partial<ProjectSourceGitHub> = {}): ProjectSourceGitHub {
  return {
    kind: 'github',
    owner: 'octocat',
    repo: 'draft',
    branch: OLD_BRANCH,
    upstream: { owner: 'konsulin-care', repo: 'draft', defaultBranch: 'main' },
    private: false,
    pushed: true,
    syncedSha: 'old-sha',
    digest: fileDigest(
      new Map([
        ['opendraft.yml', 'project: old\n'],
        ['manuscripts/paper/gone.qmd', '# Gone\n'],
      ]),
    ),
    pullNumber: 7,
    ...overrides,
  };
}

/** Build the initial project record for the tests. */
function record(value: ProjectSourceGitHub): ProjectRecord {
  return { id: 'project-1', name: 'draft', source: value, createdAt: 1, lastOpenedAt: 1 };
}

/** In-memory registry double whose setSource is observable. */
function makeRegistry(project: ProjectRecord): {
  registry: RestartDeps['registry'];
  records: Map<string, ProjectRecord>;
} {
  const records = new Map([[project.id, project]]);
  return {
    records,
    registry: {
      get: vi.fn(async (id: string) => records.get(id)),
      setSource: vi.fn(async (id: string, next: ProjectSourceGitHub) => {
        const existing = records.get(id);
        if (!existing) throw new Error(`missing ${id}`);
        records.set(id, { ...existing, source: next });
        return { id, source: next };
      }),
    },
  };
}

/** Workspace with the old scoped files and one file outside the scope. */
async function staleWorkspace(): Promise<MemoryWorkspace> {
  const workspace = new MemoryWorkspace();
  await workspace.writeFile('opendraft.yml', 'project: old\n');
  await workspace.writeFile('manuscripts/paper/gone.qmd', '# Gone\n');
  await workspace.writeFile('README.md', '# Local readme\n');
  return workspace;
}

/** Build restart dependencies with inert clone and sync doubles. */
function makeDeps(
  project: ProjectRecord,
  workspace: MemoryWorkspace,
  overrides: Partial<RestartDeps> = {},
): { deps: RestartDeps; records: Map<string, ProjectRecord> } {
  const { registry, records } = makeRegistry(project);
  const deps: RestartDeps = {
    registry,
    getWorkspace: vi.fn(async () => workspace),
    clone: vi.fn(async () => ({
      sha: 'remote-sha',
      files: new Map([
        ['opendraft.yml', 'project: new\n'],
        ['manuscripts/paper/new.qmd', '# New\n'],
        ['README.md', '# Remote readme\n'],
      ]),
    })),
    syncFork: vi.fn(async () => undefined),
    session: SESSION,
    now: vi.fn(() => NOW),
    ...overrides,
  };
  return { deps, records };
}

/** Assert the workspace holds the freshly cloned scoped files. */
async function expectFreshWorkspace(workspace: MemoryWorkspace): Promise<void> {
  await expect(workspace.listAll()).resolves.toEqual([
    'README.md',
    'manuscripts/paper/new.qmd',
    'opendraft.yml',
  ]);
  await expect(workspace.readFile('opendraft.yml')).resolves.toBe('project: new\n');
  await expect(workspace.readFile('manuscripts/paper/new.qmd')).resolves.toBe('# New\n');
  await expect(workspace.readFile('README.md')).resolves.toBe('# Local readme\n');
}

describe('restartSuggestion', () => {
  it('syncs the fork, clones the default branch and resets the branch, push and pull state', async () => {
    const workspace = await staleWorkspace();
    const { deps, records } = makeDeps(record(source()), workspace);

    const result = await restartSuggestion('project-1', deps);

    expect(deps.syncFork).toHaveBeenCalledWith('octocat', 'draft', 'main');
    expect(deps.clone).toHaveBeenCalledWith('konsulin-care', 'draft', 'main');
    await expectFreshWorkspace(workspace);

    const stored = records.get('project-1')?.source;
    expect(stored).toMatchObject({
      kind: 'github',
      owner: 'octocat',
      repo: 'draft',
      branch: NEW_BRANCH,
      pushed: false,
      pullNumber: null,
      syncedSha: 'remote-sha',
    });
    expect(stored?.kind === 'github' ? stored.digest : null).toEqual(
      fileDigest(
        new Map([
          ['opendraft.yml', 'project: new\n'],
          ['manuscripts/paper/new.qmd', '# New\n'],
          ['README.md', '# Remote readme\n'],
        ]),
      ),
    );
    expect(result).toMatchObject({ projectId: 'project-1', sha: 'remote-sha' });
  });
});

describe('restartSuggestion failed sync', () => {
  it('continues with the fresh branch when syncing the fork fails', async () => {
    const workspace = await staleWorkspace();
    const { deps, records } = makeDeps(record(source()), workspace, {
      syncFork: vi.fn(async () => {
        throw new Error('conflict');
      }),
    });

    await restartSuggestion('project-1', deps);

    expect(records.get('project-1')?.source).toMatchObject({
      branch: NEW_BRANCH,
      pushed: false,
    });
  });
});

describe('pullLatest', () => {
  it('clones the suggestion branch head and keeps the branch and pull number', async () => {
    const workspace = await staleWorkspace();
    const { deps, records } = makeDeps(record(source()), workspace);

    const result = await pullLatest('project-1', deps);

    expect(deps.clone).toHaveBeenCalledWith('octocat', 'draft', OLD_BRANCH);
    expect(deps.syncFork).not.toHaveBeenCalled();
    await expectFreshWorkspace(workspace);

    const stored = records.get('project-1')?.source;
    expect(stored).toMatchObject({
      kind: 'github',
      branch: OLD_BRANCH,
      pushed: true,
      pullNumber: 7,
      syncedSha: 'remote-sha',
    });
    expect(stored?.kind === 'github' ? stored.digest : null).toEqual(
      fileDigest(
        new Map([
          ['opendraft.yml', 'project: new\n'],
          ['manuscripts/paper/new.qmd', '# New\n'],
          ['README.md', '# Remote readme\n'],
        ]),
      ),
    );
    expect(result).toMatchObject({ projectId: 'project-1', sha: 'remote-sha' });
  });
});
