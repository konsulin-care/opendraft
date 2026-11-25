/**
 * Save to GitHub tests: automatic commit messages, pushing draft branches,
 * offline pending saves, and rebasing onto a moved remote branch.
 */
import { describe, expect, it, vi } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import type { ProjectRecord, ProjectSourceGitHub } from '@opendraft/workspace';
import type { BffSession } from '../github/bff-client';
import { fileDigest } from './file-diff';
import { saveCommitMessage, saveDraft } from './save';
import type { SaveGitHubDeps } from './save';

const SESSION: BffSession = {
  login: 'octocat',
  id: 42,
  name: 'Mona Lisa',
  expiresAt: '2026-01-01T00:00:00Z',
};

const BRANCH = 'od-octocat/paper';
const CONFIG_OLD = 'project: old\n';
const CONFIG_NEW = 'project: new\n';
const ARTICLE = '# Old\n';

/** Build a pushed draft source for the tests. */
function source(overrides: Partial<ProjectSourceGitHub> = {}): ProjectSourceGitHub {
  return {
    kind: 'github',
    owner: 'octocat',
    repo: 'draft',
    branch: BRANCH,
    upstream: { owner: 'konsulin-care', repo: 'draft', defaultBranch: 'main' },
    private: false,
    pushed: true,
    syncedSha: 'pushed-sha',
    digest: fileDigest(new Map([['opendraft.yml', CONFIG_OLD]])),
    pullNumber: null,
    ...overrides,
  };
}

/** Build a project record around a GitHub source. */
function record(value: ProjectSourceGitHub): ProjectRecord {
  return { id: 'project-1', name: 'draft', source: value, createdAt: 1, lastOpenedAt: 1 };
}

/** Repository worktree before the local edits. */
function repoFiles(): Map<string, string> {
  return new Map([
    ['opendraft.yml', CONFIG_OLD],
    ['manuscripts/paper/article.qmd', ARTICLE],
    ['manuscripts/paper/remove.md', '# Remove\n'],
  ]);
}

/** Workspace with new, changed and removed scoped files. */
async function editedWorkspace(): Promise<MemoryWorkspace> {
  const workspace = new MemoryWorkspace();
  await workspace.writeFile('opendraft.yml', CONFIG_NEW);
  await workspace.writeFile('manuscripts/paper/article.qmd', '# New\n');
  await workspace.writeFile('manuscripts/paper/new.md', '# New file\n');
  await workspace.writeFile('README.md', '# Outside scope\n');
  return workspace;
}

/** Build save dependencies with spies around an in-memory repository. */
async function makeDeps(
  workspace: MemoryWorkspace,
  overrides: Partial<SaveGitHubDeps> = {},
  options: { remoteHead?: string | null; pending?: string[] } = {},
): Promise<{ deps: SaveGitHubDeps; files: Map<string, string> }> {
  const files = repoFiles();
  const project = record(source());
  const deps: SaveGitHubDeps = {
    registry: {
      get: vi.fn(async () => project),
      setSource: vi.fn(async (id, next) => ({ id, source: next })),
    },
    getWorkspace: vi.fn(async () => workspace),
    clone: vi.fn(async () => ({ sha: 'pushed-sha', fs: {}, dir: '/' })),
    relayUrl: vi.fn((owner: string, repo: string) => `${owner}/${repo}.git`),
    readWorkingFiles: vi.fn(async () => new Map(files)),
    commitFilesOnBranch: vi.fn(async () => 'commit-sha'),
    push: vi.fn(async () => undefined),
    session: SESSION,
    openRepo: vi.fn(async () => ({ fs: {}, dir: '/repo', branch: BRANCH })),
    commitWorkspace: vi.fn(async () => 'commit-sha'),
    headSha: vi.fn(async () => 'commit-sha'),
    fetch: vi.fn(async () => undefined),
    remoteHead: vi.fn(async () => options.remoteHead ?? null),
    unpushed: vi.fn(async () => options.pending ?? []),
    rebaseOnto: vi.fn(async () => ({ tip: 'rebased-sha', backup: 'commit-sha' })),
    resolveConflicts: vi.fn(() => ({})),
    ...overrides,
  };
  return { deps, files };
}

describe('saveCommitMessage', () => {
  it('uses up to three basenames and counts the rest', () => {
    expect(
      saveCommitMessage([
        'manuscripts/paper/article.qmd',
        'manuscripts/paper/new.md',
        'opendraft.yml',
        'manuscripts/paper/remove.md',
      ]),
    ).toBe('Update article.qmd, new.md, opendraft.yml, +1 more');
  });
});

describe('saveDraft push', () => {
  it('commits with the automatic message and pushes the draft branch', async () => {
    const workspace = await editedWorkspace();
    const { deps } = await makeDeps(workspace);

    const result = await saveDraft('project-1', deps);

    expect(deps.commitWorkspace).toHaveBeenCalledWith(
      'project-1',
      'Update article.qmd, new.md, opendraft.yml, +1 more',
    );
    expect(deps.push).toHaveBeenCalledWith({}, '/repo', 'octocat/draft.git', BRANCH);
    expect(deps.registry.setSource).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({ pushed: true, syncedSha: 'commit-sha' }),
    );
    expect(result).toEqual({ kind: 'saved', sha: 'commit-sha' });
  });
});

describe('saveDraft offline', () => {
  it('keeps the local commit and reports the pending save count', async () => {
    const workspace = await editedWorkspace();
    const { deps } = await makeDeps(
      workspace,
      { push: vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))) },
      { pending: ['local-1', 'local-2'] },
    );

    const result = await saveDraft('project-1', deps);

    expect(deps.commitWorkspace).toHaveBeenCalledTimes(1);
    expect(deps.registry.setSource).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({ syncedSha: 'pushed-sha' }),
    );
    expect(result).toEqual({ kind: 'pending', pendingSaves: 2 });
  });
});

describe('saveDraft remote moved', () => {
  it('rebases unpushed commits onto origin/draft with the resolver before pushing', async () => {
    const workspace = await editedWorkspace();
    const { deps } = await makeDeps(workspace, {}, { remoteHead: 'remote-head' });

    const result = await saveDraft('project-1', deps);

    expect(deps.fetch).toHaveBeenCalledWith({}, '/repo', 'octocat/draft.git', BRANCH);
    expect(deps.rebaseOnto).toHaveBeenCalledWith({
      fs: {},
      dir: '/repo',
      branch: BRANCH,
      onto: `origin/${BRANCH}`,
      from: 'pushed-sha',
      resolve: deps.resolveConflicts,
    });
    expect(deps.push).toHaveBeenCalledWith({}, '/repo', 'octocat/draft.git', BRANCH);
    expect(deps.headSha).toHaveBeenCalled();
    expect(result).toEqual({ kind: 'saved', sha: 'commit-sha' });
  });
});
