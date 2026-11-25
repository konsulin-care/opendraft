/**
 * Persistent project repository tests: opening or cloning the IndexedDB repo,
 * committing difference-only workspace edits, and checking the repository back
 * into the workspace.
 */
import { describe, expect, it, vi } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import type { ProjectRecord, ProjectSourceGitHub } from '@opendraft/workspace';
import { isSuggestionPath } from './file-diff';
import {
  checkoutToWorkspace,
  commitWorkspace,
  openProjectRepo,
} from './project-repo';
import type { ProjectRepoDeps } from './project-repo';

const CONFIG = 'project: old\n';
const ARTICLE = '# Article\n';

/** Build a pushed GitHub project source for the tests. */
function githubSource(
  overrides: Partial<ProjectSourceGitHub> = {},
): ProjectSourceGitHub {
  return {
    kind: 'github',
    owner: 'octocat',
    repo: 'draft',
    branch: 'od/octocat/fix-typo',
    upstream: { owner: 'konsulin-care', repo: 'draft', defaultBranch: 'main' },
    private: false,
    pushed: true,
    syncedSha: 'base-sha',
    digest: {},
    pullNumber: null,
    ...overrides,
  };
}

/** Build a project record with a GitHub source. */
function project(source: ProjectSourceGitHub = githubSource()): ProjectRecord {
  return {
    id: 'project-1',
    name: 'draft',
    source,
    createdAt: 1,
    lastOpenedAt: 1,
  };
}

/** Scoped files committed in the fake repository. */
function repoFiles(): Map<string, string> {
  return new Map([
    ['README.md', '# Repo\n'],
    ['opendraft.yml', CONFIG],
    ['manuscripts/paper/article.qmd', ARTICLE],
    ['manuscripts/paper/remove.md', '# Remove\n'],
  ]);
}

/** Build fake dependencies around an in-memory repository. */
function makeDeps(options: {
  exists?: boolean;
  files?: Map<string, string>;
  workspace?: MemoryWorkspace;
} = {}) {
  const files = options.files ?? repoFiles();
  let exists = options.exists ?? false;
  const workspace = options.workspace ?? new MemoryWorkspace();
  const deps: ProjectRepoDeps = {
    getWorkspace: vi.fn(async () => workspace),
    openFs: vi.fn(() => ({ name: 'project-fs' })),
    repoExists: vi.fn(async () => exists),
    currentBranch: vi.fn(async () => 'od/octocat/fix-typo'),
    headSha: vi.fn(async () => 'existing-sha'),
    clone: vi.fn(async (_fs, _dir, opts) => {
      exists = true;
      return { sha: 'clone-sha', branch: opts.ref ?? 'main' };
    }),
    ensureBranch: vi.fn(async () => undefined),
    readWorkingFiles: vi.fn(async () => new Map(files)),
    commitFiles: vi.fn(async (_fs, _dir, opts) => {
      if (opts.changes.size === 0) return null;
      for (const [path, content] of opts.changes) {
        if (content === null) files.delete(path);
        else files.set(path, content);
      }
      return 'commit-sha';
    }),
  };
  return { deps, files, workspace };
}

/** Read the suggestion-scoped files of a workspace. */
async function scopedWorkspace(workspace: MemoryWorkspace) {
  const result = new Map<string, string>();
  for (const path of await workspace.listAll()) {
    if (!isSuggestionPath(path)) continue;
    const content = await workspace.readFile(path);
    if (content !== null) result.set(path, content);
  }
  return result;
}

describe('openProjectRepo', () => {
  it('shallow-clones the pushed branch when the project has no repository yet', async () => {
    const { deps } = makeDeps({ exists: false });

    const repo = await openProjectRepo(project(), deps);

    expect(deps.clone).toHaveBeenCalledWith({ name: 'project-fs' }, '/repo', {
      owner: 'octocat',
      repo: 'draft',
      ref: 'od/octocat/fix-typo',
    });
    expect(repo).toMatchObject({
      projectId: 'project-1',
      fs: { name: 'project-fs' },
      dir: '/repo',
      branch: 'od/octocat/fix-typo',
      sha: 'clone-sha',
      cloned: true,
    });
  });

  it('clones the upstream default branch for an unpushed project', async () => {
    const { deps } = makeDeps({ exists: false });

    await openProjectRepo(project(githubSource({ pushed: false })), deps);

    expect(deps.clone).toHaveBeenCalledWith(
      expect.anything(),
      '/repo',
      expect.objectContaining({ ref: 'main' }),
    );
  });
});

describe('openProjectRepo branch handling', () => {
  it('creates the source branch after cloning an unpushed project', async () => {
    const { deps } = makeDeps({ exists: false });
    const source = githubSource({ pushed: false });

    const repo = await openProjectRepo(project(source), deps);

    expect(deps.ensureBranch).toHaveBeenCalledWith(
      { name: 'project-fs' },
      '/repo',
      source.branch,
    );
    expect(repo.branch).toBe(source.branch);
  });

  it('ensures the source branch when reusing a repo on a different branch', async () => {
    const { deps } = makeDeps({ exists: true });
    vi.mocked(deps.currentBranch).mockResolvedValue('main');
    const source = githubSource({ pushed: false });

    const repo = await openProjectRepo(project(source), deps);

    expect(deps.ensureBranch).toHaveBeenCalledWith(
      { name: 'project-fs' },
      '/repo',
      source.branch,
    );
    expect(repo.branch).toBe(source.branch);
  });

  it('never ensures a branch for a pushed draft', async () => {
    const { deps } = makeDeps({ exists: false });

    await openProjectRepo(project(), deps);

    expect(deps.ensureBranch).not.toHaveBeenCalled();
  });
});

describe('openProjectRepo reuse', () => {
  it('reuses the existing repository instead of cloning again', async () => {
    const { deps } = makeDeps({ exists: true });

    const repo = await openProjectRepo(project(), deps);

    expect(deps.clone).not.toHaveBeenCalled();
    expect(repo).toMatchObject({
      branch: 'od/octocat/fix-typo',
      sha: 'existing-sha',
      cloned: false,
    });
  });
});

describe('commitWorkspace', () => {
  it('commits only scoped workspace files that differ from the repository', async () => {
    const workspace = new MemoryWorkspace();
    await workspace.writeFile('opendraft.yml', 'project: new\n');
    await workspace.writeFile('manuscripts/paper/article.qmd', ARTICLE);
    await workspace.writeFile('manuscripts/paper/new.md', '# New\n');
    await workspace.writeFile('README.md', '# Edited outside scope\n');
    const { deps, files } = makeDeps({ workspace });
    await openProjectRepo(project(), deps);

    const sha = await commitWorkspace('project-1', 'docs: save draft');

    const commit = vi.mocked(deps.commitFiles).mock.calls[0][2];
    expect([...commit.changes.keys()].sort()).toEqual([
      'manuscripts/paper/new.md',
      'manuscripts/paper/remove.md',
      'opendraft.yml',
    ]);
    expect(commit.changes.get('opendraft.yml')).toBe('project: new\n');
    expect(commit.changes.get('manuscripts/paper/new.md')).toBe('# New\n');
    expect(commit.changes.get('manuscripts/paper/remove.md')).toBeNull();
    expect(commit.message).toBe('docs: save draft');
    expect(sha).toBe('commit-sha');
    expect(files.get('opendraft.yml')).toBe('project: new\n');
  });

  it('returns null without committing when no scoped file differs', async () => {
    const workspace = new MemoryWorkspace();
    await workspace.writeFile('opendraft.yml', CONFIG);
    await workspace.writeFile('manuscripts/paper/article.qmd', ARTICLE);
    await workspace.writeFile('manuscripts/paper/remove.md', '# Remove\n');
    await workspace.writeFile('README.md', '# Local readme\n');
    const { deps } = makeDeps({ workspace });
    await openProjectRepo(project(), deps);
    vi.mocked(deps.commitFiles).mockClear();

    const sha = await commitWorkspace('project-1', 'docs: save draft');

    expect(sha).toBeNull();
    expect(deps.commitFiles).not.toHaveBeenCalled();
  });
});

describe('checkoutToWorkspace', () => {
  it('writes scoped repository files and deletes scoped files missing from the repo', async () => {
    const workspace = new MemoryWorkspace();
    await workspace.writeFile('manuscripts/paper/stale.md', '# Stale\n');
    await workspace.writeFile('README.md', '# Keep local readme\n');
    const { deps } = makeDeps({ workspace });
    await openProjectRepo(project(), deps);

    await checkoutToWorkspace('project-1');

    const local = await scopedWorkspace(workspace);
    expect(local).toEqual(
      new Map<string, string>([
        ['manuscripts/paper/article.qmd', ARTICLE],
        ['manuscripts/paper/remove.md', '# Remove\n'],
        ['opendraft.yml', CONFIG],
      ]),
    );
    expect(await workspace.readFile('README.md')).toBe('# Keep local readme\n');
  });
});
