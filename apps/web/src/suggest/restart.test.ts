/**
 * Start-a-new-draft tests: unsent edits become a WIP commit, only commits after
 * the last pushed SHA are replayed onto the latest default branch, and the
 * project moves to a fresh placeholder draft branch.
 */
import { describe, expect, it, vi } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import type { ProjectRecord, ProjectSourceGitHub } from '@opendraft/workspace';
import type { BffSession } from '../github/bff-client';
import { fileDigest, isSuggestionPath } from './file-diff';
import {
  RESTART_COMMIT_MESSAGE,
  restartSuggestion,
} from './restart';
import type { RestartDeps, RestartRepo } from './restart';

const SESSION: BffSession = {
  login: 'Octocat',
  id: 42,
  name: 'Mona Lisa',
  expiresAt: '2026-01-01T00:00:00Z',
};

const OLD_BRANCH = 'od-octocat/paper';
const NEW_BRANCH = 'od-octocat/untitled-draft';
const LAST_PUSHED = 'pushed-sha';
const REPLAYED = 'replayed-sha';
const ARTICLE = 'manuscripts/paper/article.qmd';

/** Build a pushed GitHub project source for the restart tests. */
function source(
  overrides: Partial<ProjectSourceGitHub> = {},
): ProjectSourceGitHub {
  return {
    kind: 'github',
    owner: 'octocat',
    repo: 'draft',
    branch: OLD_BRANCH,
    upstream: { owner: 'konsulin-care', repo: 'draft', defaultBranch: 'main' },
    private: false,
    pushed: true,
    syncedSha: LAST_PUSHED,
    digest: fileDigest(new Map([['opendraft.yml', 'project: old\n']])),
    pullNumber: 7,
    ...overrides,
  };
}

/** Build the initial project record for the tests. */
function record(value: ProjectSourceGitHub): ProjectRecord {
  return {
    id: 'project-1',
    name: 'draft',
    source: value,
    createdAt: 1,
    lastOpenedAt: 1,
  };
}

/** Repository state shared by the fake git operations. */
interface FakeRepo extends RestartRepo {
  files: Map<string, string>;
}

/** Files committed in the fake repository before the restart. */
function repoFiles(): Map<string, string> {
  return new Map([
    ['opendraft.yml', 'project: old\n'],
    [ARTICLE, '# Accepted version\n'],
    ['manuscripts/paper/remove.md', '# Remove\n'],
    ['README.md', '# Repo readme\n'],
  ]);
}

/** Workspace with unsent edits and one file outside the suggestion scope. */
async function editedWorkspace(): Promise<MemoryWorkspace> {
  const workspace = new MemoryWorkspace();
  await workspace.writeFile('opendraft.yml', 'project: edited\n');
  await workspace.writeFile(ARTICLE, '# My version\n');
  await workspace.writeFile('README.md', '# Local readme\n');
  return workspace;
}

/** Copy scoped repository files into the workspace, as checkout does. */
async function checkout(
  workspace: MemoryWorkspace,
  files: ReadonlyMap<string, string>,
): Promise<void> {
  const scoped = new Map(
    [...files].filter(([path]) => isSuggestionPath(path)),
  );
  for (const path of await workspace.listAll()) {
    if (isSuggestionPath(path) && !scoped.has(path)) {
      await workspace.deleteFile(path);
    }
  }
  for (const [path, content] of scoped) {
    await workspace.writeFile(path, content);
  }
}

/** Options that make the fake replay lose a conflict on the article file. */
interface MakeDepsOptions {
  /** Simulate a conflict on the article file. */
  conflict?: boolean;
  /** Side chosen by the resolver for the conflicted file. */
  choice?: 'mine' | 'theirs';
}

/** In-memory registry whose setSource is observable. */
function makeRegistry(records: Map<string, ProjectRecord>): RestartDeps['registry'] {
  return {
    get: vi.fn(async (id: string) => records.get(id)),
    setSource: vi.fn(async (id: string, next: ProjectSourceGitHub) => {
      const existing = records.get(id);
      if (!existing) throw new Error(`missing ${id}`);
      records.set(id, { ...existing, source: next });
      return { id, source: next };
    }),
  };
}

/** Fake repository operations shared by the restart dependency set. */
function makeRepoOps(
  repo: FakeRepo,
  workspace: MemoryWorkspace,
  options: MakeDepsOptions,
): Pick<
  RestartDeps,
  | 'commitWorkspace'
  | 'checkoutToWorkspace'
  | 'readWorkingFiles'
  | 'rebaseOnto'
  | 'resolveConflicts'
  | 'renameBranch'
> {
  return {
    commitWorkspace: vi.fn(async () => {
      repo.files.set(
        'opendraft.yml',
        (await workspace.readFile('opendraft.yml')) ?? '',
      );
      return 'wip-sha';
    }),
    checkoutToWorkspace: vi.fn(async () => checkout(workspace, repo.files)),
    readWorkingFiles: vi.fn(async () => new Map(repo.files)),
    rebaseOnto: vi.fn(async (opts) => {
      repo.files.set(ARTICLE, '# Latest upstream\n');
      if (options.conflict === true) {
        const choices = await opts.resolve([ARTICLE]);
        repo.files.set(
          ARTICLE,
          choices[ARTICLE] === 'mine'
            ? '# My version\n'
            : '# Accepted version\n',
        );
      }
      return { tip: REPLAYED, backup: 'wip-sha' };
    }),
    resolveConflicts: vi.fn(() => ({ [ARTICLE]: options.choice ?? 'mine' })),
    renameBranch: vi.fn(async (_fs, _dir, _oldName, newName) => {
      repo.branch = newName;
    }),
  };
}

/**
 * Build restart dependencies around an in-memory repository and a registry
 * whose last opened path is observable but never written by the restart.
 */
async function makeDeps(
  project: ProjectRecord,
  workspace: MemoryWorkspace,
  options: MakeDepsOptions = {},
): Promise<{
  deps: RestartDeps;
  records: Map<string, ProjectRecord>;
  repo: FakeRepo;
  meta: { lastPath: string | null };
  setLastPath: ReturnType<typeof vi.fn>;
}> {
  const records = new Map([[project.id, project]]);
  const repo: FakeRepo = {
    fs: { name: 'project-fs' },
    dir: '/repo',
    branch: OLD_BRANCH,
    files: repoFiles(),
  };
  const meta = { lastPath: ARTICLE as string | null };
  const setLastPath = vi.fn(async () => undefined);
  const deps: RestartDeps = {
    registry: makeRegistry(records),
    getWorkspace: vi.fn(async () => workspace),
    openRepo: vi.fn(async () => repo),
    ...makeRepoOps(repo, workspace, options),
    fetch: vi.fn(async () => undefined),
    headSha: vi.fn(async () => REPLAYED),
    relayUrl: vi.fn(
      (owner: string, name: string) => `${owner}/${name}.git`,
    ),
    clone: vi.fn(async () => ({ sha: REPLAYED, files: new Map(repo.files) })),
    syncFork: vi.fn(async () => undefined),
    session: SESSION,
  };

  return { deps, records, repo, meta, setLastPath };
}

describe('restartSuggestion', () => {
  it('commits unsent edits and replays only commits after the last pushed SHA', async () => {
    const workspace = await editedWorkspace();
    const { deps } = await makeDeps(record(source()), workspace);

    await restartSuggestion('project-1', deps);

    expect(deps.commitWorkspace).toHaveBeenCalledWith(
      'project-1',
      RESTART_COMMIT_MESSAGE,
    );
    expect(deps.syncFork).toHaveBeenCalledWith('octocat', 'draft', 'main');
    expect(deps.fetch).toHaveBeenCalledWith(
      { name: 'project-fs' },
      '/repo',
      'konsulin-care/draft.git',
      'main',
    );
    expect(deps.rebaseOnto).toHaveBeenCalledWith({
      fs: { name: 'project-fs' },
      dir: '/repo',
      branch: OLD_BRANCH,
      onto: 'origin/main',
      from: LAST_PUSHED,
      resolve: deps.resolveConflicts,
    });
    await expect(workspace.readFile(ARTICLE)).resolves.toBe('# Latest upstream\n');
  });

  it('sends conflicts to the resolver and writes the chosen side into the workspace', async () => {
    const workspace = await editedWorkspace();
    const { deps } = await makeDeps(record(source()), workspace, {
      conflict: true,
      choice: 'mine',
    });

    await restartSuggestion('project-1', deps);

    expect(deps.resolveConflicts).toHaveBeenCalledWith([ARTICLE]);
    await expect(workspace.readFile(ARTICLE)).resolves.toBe('# My version\n');
  });
});

describe('restartSuggestion branch reset', () => {
  it('moves to the placeholder branch and resets push state without touching the last path', async () => {
    const workspace = await editedWorkspace();
    const { deps, records, meta, setLastPath } = await makeDeps(
      record(source()),
      workspace,
    );

    const result = await restartSuggestion('project-1', deps);

    expect(deps.renameBranch).toHaveBeenCalledWith(
      { name: 'project-fs' },
      '/repo',
      OLD_BRANCH,
      NEW_BRANCH,
    );
    expect(records.get('project-1')?.source).toMatchObject({
      kind: 'github',
      branch: NEW_BRANCH,
      pushed: false,
      pullNumber: null,
      syncedSha: REPLAYED,
    });
    expect(result).toMatchObject({
      projectId: 'project-1',
      branch: NEW_BRANCH,
      sha: REPLAYED,
    });
    expect(meta.lastPath).toBe(ARTICLE);
    expect(setLastPath).not.toHaveBeenCalled();
  });
});

describe('restartSuggestion failed sync', () => {
  it('continues with the new draft when syncing the fork fails', async () => {
    const workspace = await editedWorkspace();
    const { deps, records } = await makeDeps(record(source()), workspace);
    deps.syncFork = vi.fn(async () => {
      throw new Error('conflict');
    });

    await restartSuggestion('project-1', deps);

    expect(records.get('project-1')?.source).toMatchObject({
      branch: NEW_BRANCH,
      pushed: false,
    });
  });
});
