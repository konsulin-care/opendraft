/**
 * Save to my copy tests: committing local scoped edits, refusing to overwrite
 * a moved remote branch, overwriting on request, and skipping a clean save.
 */
import { describe, expect, it, vi } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import type { ProjectRecord, ProjectSourceGitHub } from '@opendraft/workspace';
import type { BffSession } from '../github/bff-client';
import { fileDigest } from './file-diff';
import { SAVE_COMMIT_MESSAGE, saveToCopy } from './save';
import type { SaveDeps } from './save';

const SESSION: BffSession = {
  login: 'octocat',
  id: 42,
  name: 'Mona Lisa',
  expiresAt: '2026-01-01T00:00:00Z',
};

const BRANCH = 'opendraft/octocat/20260102-030405';
const CONFIG_OLD = 'project: old\n';
const CONFIG_NEW = 'project: new\n';
const ARTICLE = '# Old\n';

/** Build a pushed GitHub project source for the tests. */
function source(overrides: Partial<ProjectSourceGitHub> = {}): ProjectSourceGitHub {
  return {
    kind: 'github',
    owner: 'octocat',
    repo: 'draft',
    branch: BRANCH,
    upstream: { owner: 'konsulin-care', repo: 'draft', defaultBranch: 'main' },
    private: false,
    pushed: true,
    syncedSha: 'base-sha',
    digest: fileDigest(
      new Map([
        ['opendraft.yml', CONFIG_OLD],
        ['manuscripts/paper/article.qmd', ARTICLE],
        ['manuscripts/paper/remove.md', '# Remove\n'],
      ]),
    ),
    pullNumber: null,
    ...overrides,
  };
}

/** Build a project record with a GitHub source. */
function record(value: ProjectSourceGitHub): ProjectRecord {
  return { id: 'project-1', name: 'draft', source: value, createdAt: 1, lastOpenedAt: 1 };
}

/** Clone tree with the unchanged, config, and removable files. */
function baseFiles(): Map<string, string> {
  return new Map([
    ['README.md', '# Repo\n'],
    ['opendraft.yml', CONFIG_OLD],
    ['manuscripts/paper/article.qmd', ARTICLE],
    ['manuscripts/paper/remove.md', '# Remove\n'],
  ]);
}

/** Workspace files after the local edits in the save tests. */
async function editedWorkspace(): Promise<MemoryWorkspace> {
  const workspace = new MemoryWorkspace();
  await workspace.writeFile('opendraft.yml', CONFIG_NEW);
  await workspace.writeFile('manuscripts/paper/article.qmd', ARTICLE);
  await workspace.writeFile('manuscripts/paper/new.md', '# New\n');
  await workspace.writeFile('README.md', '# Edited outside scope\n');
  return workspace;
}

/** Build save dependencies with inert defaults and spy hooks. */
function makeDeps(
  project: ProjectRecord,
  workspace: MemoryWorkspace,
  overrides: Partial<SaveDeps> = {},
  options: { sha?: string; files?: Map<string, string> } = {},
): { deps: SaveDeps; files: Map<string, string> } {
  const files = options.files ?? baseFiles();
  const deps: SaveDeps = {
    registry: {
      get: vi.fn(async () => project as ProjectRecord),
      setSource: vi.fn(async (id, next) => ({ id, source: next })),
    },
    getWorkspace: vi.fn(async () => workspace),
    clone: vi.fn(async () => ({ sha: options.sha ?? 'base-sha', fs: {}, dir: '/' })),
    relayUrl: vi.fn((owner: string, repo: string) => `${owner}/${repo}.git`),
    readWorkingFiles: vi.fn(async () => new Map(files)),
    commitFilesOnBranch: vi.fn(async (_fs, _dir, commit) => {
      for (const [path, content] of commit.files) {
        files.set(path, content);
      }
      for (const path of commit.remove ?? []) {
        files.delete(path);
      }
      return 'new-sha';
    }),
    push: vi.fn(async () => undefined),
    session: SESSION,
    ...overrides,
  };
  return { deps, files };
}

/** Assert the commit built from the local edits. */
function expectEditedCommit(deps: SaveDeps): void {
  const commit = vi.mocked(deps.commitFilesOnBranch).mock.calls[0][2];
  expect([...commit.files.keys()].sort()).toEqual([
    'manuscripts/paper/new.md',
    'opendraft.yml',
  ]);
  expect(commit.files.get('opendraft.yml')).toBe(CONFIG_NEW);
  expect(commit.remove).toEqual(['manuscripts/paper/remove.md']);
  expect(commit.branch).toBe(BRANCH);
  expect(commit.message).toBe(SAVE_COMMIT_MESSAGE);
  expect(commit.author).toEqual({
    name: 'Mona Lisa',
    email: '42+octocat@users.noreply.github.com',
  });
}

/** Assert the stored source after a successful save. */
function expectStoredSource(deps: SaveDeps, files: Map<string, string>): void {
  expect(deps.registry.setSource).toHaveBeenCalledWith(
    'project-1',
    expect.objectContaining({
      kind: 'github',
      owner: 'octocat',
      repo: 'draft',
      branch: BRANCH,
      pushed: true,
      syncedSha: 'new-sha',
    }),
  );
  const saved = vi.mocked(deps.registry.setSource).mock.calls[0][1];
  expect(saved.digest).toEqual(fileDigest(files));
}

describe('saveToCopy local changes', () => {
  it('commits only changed and removed scoped files, pushes and stores the new sync state', async () => {
    const workspace = await editedWorkspace();
    const { deps, files } = makeDeps(record(source()), workspace);

    const result = await saveToCopy('project-1', {}, deps);

    expect(deps.clone).toHaveBeenCalledWith('octocat', 'draft', BRANCH);
    expectEditedCommit(deps);
    expect(deps.push).toHaveBeenCalledWith({}, '/', 'octocat/draft.git', BRANCH);
    expectStoredSource(deps, files);
    expect(result).toEqual({ kind: 'saved', sha: 'new-sha', upstreamMoved: false });
  });

  it('warns when an unpushed suggestion base moved and clones the default branch', async () => {
    const workspace = await editedWorkspace();
    const { deps } = makeDeps(
      record(source({ pushed: false, syncedSha: 'start-sha' })),
      workspace,
      {},
      { sha: 'default-head' },
    );

    const result = await saveToCopy('project-1', {}, deps);

    expect(deps.clone).toHaveBeenCalledWith('octocat', 'draft', 'main');
    expect(result).toEqual({ kind: 'saved', sha: 'new-sha', upstreamMoved: true });
  });
});

describe('saveToCopy remote moved', () => {
  it('returns remote-moved without committing or pushing when the branch head differs', async () => {
    const workspace = await editedWorkspace();
    const { deps } = makeDeps(record(source({ syncedSha: 'old-sha' })), workspace, {}, {
      sha: 'remote-head',
    });

    const result = await saveToCopy('project-1', {}, deps);

    expect(result).toEqual({ kind: 'remote-moved' });
    expect(deps.commitFilesOnBranch).not.toHaveBeenCalled();
    expect(deps.push).not.toHaveBeenCalled();
    expect(deps.registry.setSource).not.toHaveBeenCalled();
  });

  it('commits local versions on top of the remote head when overwrite is requested', async () => {
    const workspace = await editedWorkspace();
    const remote = baseFiles();
    remote.set('manuscripts/paper/article.qmd', '# Remote article\n');
    const { deps, files } = makeDeps(
      record(source({ syncedSha: 'old-sha' })),
      workspace,
      {},
      { sha: 'remote-head', files: remote },
    );

    const result = await saveToCopy('project-1', { overwrite: true }, deps);

    const commit = vi.mocked(deps.commitFilesOnBranch).mock.calls[0][2];
    expect([...commit.files.keys()].sort()).toEqual([
      'manuscripts/paper/new.md',
      'opendraft.yml',
    ]);
    expect(commit.files.get('manuscripts/paper/article.qmd')).toBeUndefined();
    expect(files.get('manuscripts/paper/article.qmd')).toBe('# Remote article\n');
    expect(deps.push).toHaveBeenCalledWith({}, '/', 'octocat/draft.git', BRANCH);
    expect(result).toEqual({ kind: 'saved', sha: 'new-sha', upstreamMoved: false });
  });
});

describe('saveToCopy clean workspace', () => {
  it('returns unchanged without committing or pushing when no scoped file differs', async () => {
    const workspace = new MemoryWorkspace();
    await workspace.writeFile('opendraft.yml', CONFIG_OLD);
    await workspace.writeFile('manuscripts/paper/article.qmd', ARTICLE);
    await workspace.writeFile('manuscripts/paper/remove.md', '# Remove\n');
    await workspace.writeFile('README.md', '# Local readme\n');
    const { deps } = makeDeps(record(source()), workspace);

    const result = await saveToCopy('project-1', {}, deps);

    expect(result).toEqual({ kind: 'unchanged' });
    expect(deps.commitFilesOnBranch).not.toHaveBeenCalled();
    expect(deps.push).not.toHaveBeenCalled();
    expect(deps.registry.setSource).not.toHaveBeenCalled();
  });
});
