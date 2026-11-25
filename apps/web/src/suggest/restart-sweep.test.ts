/**
 * Restart sweep tests: the remote branch sweep runs last, sees the stored new
 * draft source, and can never fail or preempt a restart.
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

const OLD_BRANCH = 'od-octocat/paper';
const NEW_BRANCH = 'od-octocat/untitled-draft';

/** Build the pushed GitHub source of the draft before the restart. */
function source(): ProjectSourceGitHub {
  return {
    kind: 'github',
    owner: 'konsulin-care',
    repo: 'draft',
    branch: OLD_BRANCH,
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
    branch: OLD_BRANCH,
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

describe('restartSuggestion sweep ordering', () => {
  it('calls the sweep only after the new draft source has been stored', async () => {
    const { deps, records } = await makeDeps();
    const seen: Array<{
      stored: ProjectSourceGitHub | undefined;
      source: ProjectSourceGitHub;
    }> = [];
    deps.sweepBranches = vi.fn(async (next: ProjectSourceGitHub) => {
      const stored = records.get('project-1')?.source;
      seen.push({
        stored: stored?.kind === 'github' ? stored : undefined,
        source: next,
      });
    });

    await restartSuggestion('project-1', deps);

    expect(deps.sweepBranches).toHaveBeenCalledTimes(1);
    expect(seen[0]?.source).toMatchObject({
      branch: NEW_BRANCH,
      pushed: false,
      pullNumber: null,
    });
    expect(seen[0]?.stored).toBe(seen[0]?.source);
  });
});

describe('restartSuggestion sweep failures', () => {
  it('does not fail the restart when the sweep rejects', async () => {
    const { deps } = await makeDeps();
    deps.sweepBranches = vi.fn(async () => {
      throw new Error('sweep failed');
    });

    await expect(restartSuggestion('project-1', deps)).resolves.toMatchObject({
      projectId: 'project-1',
      branch: NEW_BRANCH,
    });
  });
});

describe('restartSuggestion failed rebase', () => {
  it('leaves the stored source unchanged and never calls the sweep', async () => {
    const { deps, records } = await makeDeps();
    deps.rebaseOnto = vi.fn(async () => {
      throw new Error('rebase conflict');
    });
    deps.sweepBranches = vi.fn(async () => undefined);

    await expect(restartSuggestion('project-1', deps)).rejects.toThrow(
      'rebase conflict',
    );

    expect(records.get('project-1')?.source).toMatchObject({
      branch: OLD_BRANCH,
      pushed: true,
      pullNumber: 7,
    });
    expect(deps.sweepBranches).not.toHaveBeenCalled();
  });
});
