/**
 * Purge tests: private GitHub projects disappear on sign-out, while local,
 * public and error cases keep the registry untouched.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ProjectRecord, ProjectSource } from '@opendraft/workspace';
import type { SessionState } from '../github/bff-client';
import { purgeIfSignedOut, purgePrivateProjects } from './purge';

const SESSION_STATE: SessionState = {
  session: {
    login: 'octocat',
    id: 42,
    name: 'Mona Lisa',
    expiresAt: '2026-01-01T00:00:00Z',
  },
  loginEnabled: true,
};

const SIGNED_OUT_STATE: SessionState = { session: null, loginEnabled: true };

/** Build a GitHub project source with the given visibility. */
function githubSource(privateRepo: boolean): ProjectSource {
  return {
    kind: 'github',
    owner: 'octocat',
    repo: 'draft',
    branch: 'opendraft/octocat/20260102-030405',
    upstream: { owner: 'octocat', repo: 'draft', defaultBranch: 'main' },
    private: privateRepo,
    pushed: false,
    syncedSha: 'aaa111',
    digest: {},
    pullNumber: null,
  };
}

/** Build a project record with the given source. */
function record(id: string, source: ProjectSource): ProjectRecord {
  return { id, name: id, source, createdAt: 1, lastOpenedAt: 1 };
}

/** Registry double keeping records in memory and recording removals. */
function makeRegistry(initial: ProjectRecord[]): {
  registry: { list: () => Promise<ProjectRecord[]>; remove: (id: string) => Promise<void> };
  records: Map<string, ProjectRecord>;
  remove: ReturnType<typeof vi.fn>;
} {
  const records = new Map(initial.map((project) => [project.id, project]));
  const remove = vi.fn(async (id: string) => {
    records.delete(id);
  });
  return {
    records,
    remove,
    registry: {
      list: vi.fn(async () => [...records.values()]),
      remove,
    },
  };
}

describe('purgePrivateProjects', () => {
  it('removes private GitHub projects and keeps local and public ones', async () => {
    const { registry, records } = makeRegistry([
      record('local', { kind: 'local' }),
      record('public', githubSource(false)),
      record('private', githubSource(true)),
    ]);

    const purged = await purgePrivateProjects(registry);

    expect(purged.map((project) => project.id)).toEqual(['private']);
    expect([...records.keys()].sort()).toEqual(['local', 'public']);
  });
});

describe('purgeIfSignedOut', () => {
  it('purges when the session state has no session', async () => {
    const { registry, records } = makeRegistry([
      record('local', { kind: 'local' }),
      record('private', githubSource(true)),
    ]);
    const getSessionState = vi.fn(async () => SIGNED_OUT_STATE);

    await purgeIfSignedOut(getSessionState, registry);

    expect(getSessionState).toHaveBeenCalledTimes(1);
    expect([...records.keys()]).toEqual(['local']);
  });

  it('keeps private projects when a session exists', async () => {
    const { registry, records, remove } = makeRegistry([
      record('private', githubSource(true)),
    ]);

    await purgeIfSignedOut(async () => SESSION_STATE, registry);

    expect(remove).not.toHaveBeenCalled();
    expect([...records.keys()]).toEqual(['private']);
  });

  it('purges nothing when the session request throws', async () => {
    const { registry, records, remove } = makeRegistry([
      record('private', githubSource(true)),
    ]);

    await expect(
      purgeIfSignedOut(async () => {
        throw new Error('network down');
      }, registry),
    ).resolves.toEqual([]);

    expect(remove).not.toHaveBeenCalled();
    expect([...records.keys()]).toEqual(['private']);
  });
});
