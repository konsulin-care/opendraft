/**
 * Publish tests: repository creation, the first commit on main, the resulting
 * GitHub source and the plain-language permission failure.
 */
import { describe, expect, it, vi } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import type { ProjectRecord, ProjectSourceGitHub } from '@opendraft/workspace';
import { BffError } from '../github/bff-client';
import type { BffSession } from '../github/bff-client';
import { fileDigest } from './file-diff';
import {
  PUBLISH_BRANCH,
  PUBLISH_COMMIT_MESSAGE,
  publishProject,
} from './publish';
import type { PublishProjectDeps, PublishTarget } from './publish';

const SESSION: BffSession = {
  login: 'octocat',
  id: 42,
  name: 'Mona Lisa',
  expiresAt: '2026-01-01T00:00:00Z',
};
const TARGET: PublishTarget = {
  owner: 'octocat',
  ownerIsUser: true,
  name: 'paper',
  private: false,
};
const SCOPED_FILES = new Map([
  ['opendraft.yml', 'protocol: v1\n'],
  ['manuscripts/paper/article.qmd', '# Paper\n'],
]);

/** Build a local project record. */
function record(id = 'project-1'): ProjectRecord {
  return { id, name: 'paper', source: { kind: 'local' }, createdAt: 1, lastOpenedAt: 1 };
}

/** Build publish dependencies with inert repository operations. */
function makeDeps(overrides: Partial<PublishProjectDeps> = {}) {
  const workspace = new MemoryWorkspace();
  const project = record();
  const source = vi.fn(async () => undefined);
  const deps: PublishProjectDeps = {
    registry: {
      get: vi.fn(async () => project),
      setSource: source,
    },
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
  return { deps, workspace, project, source };
}

/** Seed a workspace with suggestion-scoped and unrelated files. */
async function seedWorkspace(workspace: MemoryWorkspace): Promise<void> {
  await workspace.writeFile('opendraft.yml', 'protocol: v1\n');
  await workspace.writeFile('manuscripts/paper/article.qmd', '# Paper\n');
  await workspace.writeFile('notes.txt', 'not part of a manuscript\n');
}

/** Expected GitHub source of a published public project. */
function expectedSource(): ProjectSourceGitHub {
  return {
    kind: 'github',
    owner: 'octocat',
    repo: 'paper',
    branch: 'main',
    upstream: { owner: 'octocat', repo: 'paper', defaultBranch: 'main' },
    private: false,
    pushed: true,
    pullNumber: null,
    syncedSha: 'commit-sha',
    digest: fileDigest(SCOPED_FILES),
  };
}

describe('publishProject', () => {
  it('creates the repository and pushes the first commit to main', async () => {
    const { deps, workspace } = makeDeps();
    await seedWorkspace(workspace);

    await publishProject('project-1', TARGET, deps);

    expect(deps.createRepo).toHaveBeenCalledWith({
      owner: 'octocat',
      name: 'paper',
      visibility: 'public',
    });
    expect(deps.initRepo).toHaveBeenCalledWith('project-1', PUBLISH_BRANCH);

    const [fs, dir, commit] = vi.mocked(deps.commitFiles).mock.calls[0];
    expect([fs, dir]).toEqual(['fs', '/repo']);
    expect(commit).toMatchObject({
      branch: 'main',
      message: PUBLISH_COMMIT_MESSAGE,
      files: SCOPED_FILES,
    });
    expect(deps.push).toHaveBeenCalledWith(
      'fs',
      '/repo',
      'https://example.test/@api/git/octocat/paper.git',
      'main',
    );
  });

  it('stores an own GitHub source with the pushed commit', async () => {
    const { deps, workspace, source } = makeDeps();
    await seedWorkspace(workspace);

    const result = await publishProject('project-1', TARGET, deps);

    expect(result).toEqual(expectedSource());
    expect(source).toHaveBeenCalledWith('project-1', expectedSource());
  });
});

describe('publishProject visibility and permissions', () => {
  it('marks a private repository and sends its private visibility', async () => {
    const { deps } = makeDeps();

    const result = await publishProject(
      'project-1',
      { ...TARGET, private: true },
      deps,
    );

    expect(deps.createRepo).toHaveBeenCalledWith({
      owner: 'octocat',
      name: 'paper',
      visibility: 'private',
    });
    expect(result).toMatchObject({ private: true, branch: 'main', pushed: true });
  });

  it('rejects a 403 from repository creation with a permission message', async () => {
    const { deps, source } = makeDeps({
      createRepo: vi.fn(async () => {
        throw new BffError('forbidden', 403);
      }),
    });

    await expect(
      publishProject('project-1', { ...TARGET, owner: 'konsulin-care' }, deps),
    ).rejects.toThrow(
      "You don't have permission to create repositories in konsulin-care.",
    );
    expect(deps.initRepo).not.toHaveBeenCalled();
    expect(source).not.toHaveBeenCalled();
  });
});
