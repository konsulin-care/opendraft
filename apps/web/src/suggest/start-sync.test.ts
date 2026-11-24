/**
 * Start sync tests: a draft created on the upstream itself is never synced as
 * if it were a fork; fork targets keep syncing.
 */
import { describe, expect, it, vi } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import type { ProjectRecord, ProjectSource, ProjectSourceGitHub } from '@opendraft/workspace';
import type { BffSession, RepoPermissions } from '../github/bff-client';
import { startSuggestion } from './start';
import type { StartSuggestionDeps } from './start';

const SESSION: BffSession = {
  login: 'octocat',
  id: 42,
  name: 'Mona Lisa',
  expiresAt: '2026-01-01T00:00:00Z',
};

const ACCESS: RepoPermissions = {
  push: true,
  installed: true,
  defaultBranch: 'main',
  private: false,
  allowForking: true,
  viewerInstalledAll: true,
};

/** Build a registry double that keeps records in memory. */
function makeRegistry(): StartSuggestionDeps['registry'] {
  const records = new Map<string, ProjectRecord>();
  return {
    list: vi.fn(async () => [...records.values()]),
    create: vi.fn(async (name: string, source?: ProjectSourceGitHub) => {
      const project: ProjectRecord = {
        id: 'project-1',
        name,
        source: source ?? ({ kind: 'local' } as ProjectSource),
        createdAt: 1,
        lastOpenedAt: 1,
      };
      records.set(project.id, project);
      return project;
    }),
    setSource: vi.fn(async (id: string, source: ProjectSourceGitHub) => {
      const updated = { ...records.get(id)!, source };
      records.set(id, updated);
      return updated;
    }),
  };
}

/** Build start dependencies with inert defaults. */
function makeDeps(
  registry: StartSuggestionDeps['registry'],
  syncFork: StartSuggestionDeps['syncFork'],
): StartSuggestionDeps {
  return {
    registry,
    getWorkspace: vi.fn(async () => new MemoryWorkspace()),
    forkRepo: vi.fn(async () => ({
      owner: 'octocat',
      repo: 'draft',
      defaultBranch: 'main',
    })),
    syncFork,
    listSuggestionBranches: vi.fn(async () => []),
    findSuggestionPull: vi.fn(async () => null),
    prepareRepo: vi.fn(async (_project: ProjectRecord, branch: string) => ({
      sha: 'prepared-sha',
      branch,
      files: new Map<string, string>(),
    })),
  };
}

/** Build the start input for the upstream repository. */
function input(plan: 'branch' | 'fork') {
  return {
    upstream: { owner: 'konsulin-care', repo: 'draft' },
    session: SESSION,
    plan,
    access: ACCESS,
  };
}

describe('startSuggestion branch plan', () => {
  it('does not sync the upstream when the draft lives on it', async () => {
    const registry = makeRegistry();
    const syncFork = vi.fn(async () => undefined);
    const deps = makeDeps(registry, syncFork);

    const result = await startSuggestion(input('branch'), deps);

    expect(result.resumed).toBe('fresh');
    expect(syncFork).not.toHaveBeenCalled();
    expect(deps.forkRepo).not.toHaveBeenCalled();
  });
});

describe('startSuggestion fork plan', () => {
  it('still syncs the fork before creating the draft', async () => {
    const registry = makeRegistry();
    const syncFork = vi.fn(async () => undefined);
    const deps = makeDeps(registry, syncFork);

    const result = await startSuggestion(input('fork'), deps);

    expect(result.resumed).toBe('fresh');
    expect(syncFork).toHaveBeenCalledWith('octocat', 'draft', 'main');
  });
});
