/**
 * Restart sync tests: the fork is only synced when the draft branch lives on a
 * fork, never when it already lives on the upstream repository itself.
 */
import { describe, expect, it, vi } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import type { ProjectRecord, ProjectSourceGitHub } from '@opendraft/workspace';
import type { BffSession } from '../github/bff-client';
import { restartSuggestion } from './restart';
import type { RestartDeps } from './restart';

const SESSION: BffSession = {
  login: 'octocat',
  id: 42,
  name: 'Mona Lisa',
  expiresAt: '2026-01-01T00:00:00Z',
};

/** Build a GitHub source whose branch already lives on the upstream. */
function source(): ProjectSourceGitHub {
  return {
    kind: 'github',
    owner: 'Konsulin-Care',
    repo: 'Draft',
    branch: 'od-octocat/paper',
    upstream: { owner: 'konsulin-care', repo: 'draft', defaultBranch: 'main' },
    private: false,
    pushed: true,
    syncedSha: 'pushed-sha',
    digest: {},
    pullNumber: 7,
  };
}

/** Build minimal restart dependencies around an in-memory workspace. */
async function makeDeps(): Promise<{
  deps: RestartDeps;
  records: Map<string, ProjectRecord>;
}> {
  const workspace = new MemoryWorkspace();
  const records = new Map<string, ProjectRecord>([
    [
      'project-1',
      {
        id: 'project-1',
        name: 'Draft',
        source: source(),
        createdAt: 1,
        lastOpenedAt: 1,
      },
    ],
  ]);
  const repo = {
    fs: { name: 'project-fs' },
    dir: '/repo',
    branch: 'od-octocat/paper',
  };
  const deps: RestartDeps = {
    registry: {
      get: vi.fn(async (id: string) => records.get(id)),
      setSource: vi.fn(async (id: string, next: ProjectSourceGitHub) => {
        records.set(id, { ...records.get(id)!, source: next });
        return { id, source: next };
      }),
    },
    getWorkspace: vi.fn(async () => workspace),
    openRepo: vi.fn(async () => repo),
    commitWorkspace: vi.fn(async () => 'wip-sha'),
    checkoutToWorkspace: vi.fn(async () => undefined),
    fetch: vi.fn(async () => undefined),
    headSha: vi.fn(async () => 'replayed-sha'),
    readWorkingFiles: vi.fn(async () => new Map([['opendraft.yml', 'v1']])),
    relayUrl: vi.fn((owner: string, name: string) => `${owner}/${name}.git`),
    rebaseOnto: vi.fn(async () => ({ tip: 'replayed-sha', backup: 'wip-sha' })),
    resolveConflicts: vi.fn(() => ({})),
    renameBranch: vi.fn(async (_fs, _dir, _oldName, newName) => {
      repo.branch = newName;
    }),
    clone: vi.fn(async () => ({ sha: 'replayed-sha', files: new Map() })),
    syncFork: vi.fn(async () => undefined),
    session: SESSION,
  };
  return { deps, records };
}

describe('restartSuggestion upstream target', () => {
  it('does not sync the fork and still completes the restart', async () => {
    const { deps, records } = await makeDeps();

    const result = await restartSuggestion('project-1', deps);

    expect(deps.syncFork).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      projectId: 'project-1',
      branch: 'od-octocat/untitled-draft',
      sha: 'replayed-sha',
    });
    expect(records.get('project-1')?.source).toMatchObject({
      branch: 'od-octocat/untitled-draft',
      pushed: false,
      pullNumber: null,
    });
  });
});
