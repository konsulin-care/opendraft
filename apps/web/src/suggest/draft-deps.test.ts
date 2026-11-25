/**
 * Draft wiring tests: the editor's publish action must run the real
 * {@link publishProject} flow and surface its failures instead of the old
 * placeholder notice.
 */
import { describe, expect, it, vi } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import type { ProjectRecord, ProjectSourceGitHub } from '@opendraft/workspace';
import { BffError } from '../github/bff-client';
import type { BffSession } from '../github/bff-client';
import { createDraftSectionDeps } from './draft-deps';
import { PUBLISH_BRANCH } from './publish';
import type { PublishProjectDeps } from './publish';

const SESSION: BffSession = {
  login: 'octocat',
  id: 42,
  name: 'Mona Lisa',
  expiresAt: '2026-01-01T00:00:00Z',
};

/** Build a local project record. */
function record(): ProjectRecord {
  return { id: 'project-1', name: 'paper', source: { kind: 'local' }, createdAt: 1, lastOpenedAt: 1 };
}

/**
 * Build publish dependencies whose repository operations are inert fakes.
 *
 * @param overrides - Dependencies to replace.
 * @returns Publish dependencies plus the recorded source writes.
 */
function makePublishDeps(overrides: Partial<PublishProjectDeps> = {}) {
  const workspace = new MemoryWorkspace();
  const setSource = vi.fn(async () => undefined);
  const deps: PublishProjectDeps = {
    registry: { get: vi.fn(async () => record()), setSource },
    getWorkspace: vi.fn(async () => workspace),
    createRepo: vi.fn(async () => ({
      owner: 'octocat',
      name: 'paper',
      htmlUrl: 'https://github.com/octocat/paper',
      defaultBranch: 'main',
    })),
    initRepo: vi.fn(async () => ({ fs: 'fs', dir: '/repo' })),
    commitFiles: vi.fn(async () => 'commit-sha'),
    push: vi.fn(async () => undefined),
    relayUrl: (owner, repo) => `https://example.test/@api/git/${owner}/${repo}.git`,
    session: SESSION,
    ...overrides,
  };
  return { deps, setSource };
}

/** Act context handed to a draft action. */
function context() {
  return { project: record(), resolveConflicts: () => ({}) };
}

describe('createDraftSectionDeps publish', () => {
  it('creates the repository, commits the first files and resolves with the own-project source', async () => {
    const { deps, setSource } = makePublishDeps();
    const draft = createDraftSectionDeps(SESSION, { publishDeps: deps });

    await draft.publish(context(), { owner: 'octocat', repo: 'paper', private: false });

    expect(deps.createRepo).toHaveBeenCalledWith({
      owner: 'octocat',
      name: 'paper',
      visibility: 'public',
    });
    expect(deps.commitFiles).toHaveBeenCalledTimes(1);
    expect(deps.push).toHaveBeenCalledWith('fs', '/repo', expect.any(String), PUBLISH_BRANCH);

    const [id, source] = setSource.mock.calls[0] as unknown as [string, ProjectSourceGitHub];
    expect(id).toBe('project-1');
    expect(source).toMatchObject({ kind: 'github', owner: 'octocat', repo: 'paper', branch: 'main' });
  });

  it('surfaces the permission message when repository creation is forbidden', async () => {
    const { deps } = makePublishDeps({
      createRepo: vi.fn(async () => {
        throw new BffError('forbidden', 403);
      }),
    });
    const draft = createDraftSectionDeps(SESSION, { publishDeps: deps });

    await expect(
      draft.publish(context(), { owner: 'acme-lab', repo: 'paper', private: true }),
    ).rejects.toThrow("You don't have permission to create repositories in acme-lab.");
  });

  it('rejects when the viewer is signed out instead of throwing a placeholder notice', async () => {
    const { deps } = makePublishDeps();
    const draft = createDraftSectionDeps(null, { publishDeps: deps });

    await expect(
      draft.publish(context(), { owner: 'octocat', repo: 'paper', private: false }),
    ).rejects.toThrow('Sign in to GitHub first.');
  });
});
