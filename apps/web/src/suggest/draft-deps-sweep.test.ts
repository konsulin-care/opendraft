/**
 * Draft open sweep tests: opening a GitHub project sweeps stale draft branches
 * once per project id, never for local or signed-out editors, and a failed
 * sweep never changes the returned snapshot.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ProjectRecord } from '@opendraft/workspace';
import type { BffSession } from '../github/bff-client';
import { createDraftSectionDeps } from './draft-deps';

vi.mock('./browser-deps', () => ({
  createCheckDeps: vi.fn(async () => ({})),
}));

vi.mock('./status', () => ({
  checkSuggestion: vi.fn(async () => ({ state: 'draft' })),
}));

const SESSION: BffSession = {
  login: 'octocat',
  id: 42,
  name: 'Mona Lisa',
  expiresAt: '2026-01-01T00:00:00Z',
};

/** Build a GitHub-backed project record. */
function githubRecord(id: string): ProjectRecord {
  return {
    id,
    name: 'draft',
    source: {
      kind: 'github',
      owner: 'octocat',
      repo: 'draft',
      branch: 'od-octocat/paper',
      upstream: { owner: 'octocat', repo: 'draft', defaultBranch: 'main' },
      private: false,
      pushed: true,
      syncedSha: 'sha',
      digest: {},
      pullNumber: null,
    },
    createdAt: 1,
    lastOpenedAt: 1,
  };
}

/** Build a local project record. */
function localRecord(id: string): ProjectRecord {
  return {
    id,
    name: 'paper',
    source: { kind: 'local' },
    createdAt: 1,
    lastOpenedAt: 1,
  };
}

describe('draft open sweep', () => {
  it('sweeps once on the first load of a GitHub project and never on later loads', async () => {
    const project = githubRecord('sweep-once');
    const sweep = vi.fn(async () => undefined);
    const deps = createDraftSectionDeps(SESSION, { sweep });

    const first = await deps.load(project);
    const second = await deps.load(project);
    expect(first.status).toEqual({ state: 'draft' });
    expect(second.status).toEqual({ state: 'draft' });
    expect(sweep).toHaveBeenCalledTimes(1);
    expect(sweep).toHaveBeenCalledWith(project, SESSION);
  });

  it('never sweeps a local project', async () => {
    const sweep = vi.fn(async () => undefined);
    const deps = createDraftSectionDeps(SESSION, { sweep });

    const snapshot = await deps.load(localRecord('local-sweep'));
    expect(snapshot.status).toEqual({ state: 'local-only' });
    expect(sweep).not.toHaveBeenCalled();
  });

  it('never sweeps without a signed-in session', async () => {
    const sweep = vi.fn(async () => undefined);
    const deps = createDraftSectionDeps(null, { sweep });

    const snapshot = await deps.load(githubRecord('signed-out-sweep'));

    expect(snapshot.status).toEqual({ state: 'draft' });
    expect(sweep).not.toHaveBeenCalled();
  });

  it('returns the snapshot unchanged when the sweep rejects', async () => {
    const project = githubRecord('rejecting-sweep');
    const sweep = vi.fn(async () => {
      throw new Error('sweep failed');
    });
    const deps = createDraftSectionDeps(SESSION, { sweep });

    const snapshot = await deps.load(project);

    expect(snapshot).toEqual({
      status: { state: 'draft' },
      pendingSaves: undefined,
    });
    expect(sweep).toHaveBeenCalledTimes(1);
  });
});
