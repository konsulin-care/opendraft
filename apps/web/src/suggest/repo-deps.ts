/**
 * Browser wiring for the persistent project repository.
 *
 * Kept separate from `browser-deps.ts` so the suggestion flow can grow without
 * pushing that file over the size limit. Git, its Buffer polyfill and the
 * isomorphic-git HTTP client load lazily, so ordinary editor pages never pay
 * for git until a project repository is opened.
 */

import { workspaceManager } from '@opendraft/workspace';
import type { ProjectRecord, ProjectSourceGitHub } from '@opendraft/workspace';
import type { FsClient } from '../../../../packages/git/node_modules/isomorphic-git/index.js';
import type { HttpClient } from '../../../../packages/git/node_modules/isomorphic-git/http/web/index.js';
import type { BffSession } from '../github/bff-client';
import { projectRegistry } from '../hooks/useProjects';
import { author } from '../reader/convert';
import type { PreparedDraftRepo } from './import';
import {
  commitWorkspace as commitProjectWorkspace,
  openProjectRepo,
} from './project-repo';
import type { ProjectRepoDeps } from './project-repo';
import type {
  SaveClone,
  SaveConflictChoice,
  SaveConflictResolver,
  SaveGitHubDeps,
} from './save';

type GitModule = typeof import('@opendraft/git');
type IsoGit =
  typeof import('../../../../packages/git/node_modules/isomorphic-git/index.js').default;

/** Loaded git implementation, its HTTP client and raw isomorphic-git. */
interface BrowserRepoGit {
  /** Isomorphic-git wrapper exports. */
  git: GitModule;
  /** Raw isomorphic-git functions used for repository state. */
  iso: IsoGit;
  /** HTTP client used by remote operations. */
  http: HttpClient;
}

/**
 * Load the Buffer polyfill, git implementation and isomorphic-git HTTP client.
 *
 * @returns The git module, raw isomorphic-git and its HTTP client.
 */
async function loadGit(): Promise<BrowserRepoGit> {
  await import('../github/buffer-polyfill');
  const git = await import('@opendraft/git');
  const iso = (
    await import('../../../../packages/git/node_modules/isomorphic-git/index.js')
  ).default as IsoGit;
  const http = (
    await import(
      '../../../../packages/git/node_modules/isomorphic-git/http/web/index.js'
    )
  ).default as HttpClient;
  return { git, iso, http };
}

/**
 * Check whether a filesystem already contains a repository with a HEAD.
 *
 * @param iso - Raw isomorphic-git functions.
 * @param fs - Project filesystem.
 * @param dir - Repository directory.
 * @returns `true` when HEAD resolves.
 */
async function repoExists(
  iso: IsoGit,
  fs: unknown,
  dir: string,
): Promise<boolean> {
  try {
    await iso.resolveRef({ fs: fs as FsClient, dir, ref: 'HEAD' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the currently checked-out branch of a repository.
 *
 * @param iso - Raw isomorphic-git functions.
 * @param fs - Project filesystem.
 * @param dir - Repository directory.
 * @returns Branch name, or an empty string when HEAD is detached.
 */
async function currentBranch(
  iso: IsoGit,
  fs: unknown,
  dir: string,
): Promise<string> {
  const branch = await iso.currentBranch({ fs: fs as FsClient, dir });
  return branch ?? '';
}

/**
 * Resolve the HEAD commit SHA of a repository.
 *
 * @param iso - Raw isomorphic-git functions.
 * @param fs - Project filesystem.
 * @param dir - Repository directory.
 * @returns The HEAD commit SHA.
 */
async function headSha(
  iso: IsoGit,
  fs: unknown,
  dir: string,
): Promise<string> {
  return iso.resolveRef({ fs: fs as FsClient, dir, ref: 'HEAD' });
}

/**
 * Build the dependencies of the project repository for the browser.
 *
 * @param session - Signed-in viewer used as the commit author.
 * @returns Filesystem, clone, read and commit dependencies.
 */
export async function createProjectRepoDeps(
  session: BffSession,
): Promise<ProjectRepoDeps> {
  const { git, iso, http } = await loadGit();
  const identity = author(session);

  return {
    getWorkspace: (id) => workspaceManager.get(id),
    openFs: (id) => git.openProjectFs(id),
    repoExists: (fs, dir) => repoExists(iso, fs, dir),
    currentBranch: (fs, dir) => currentBranch(iso, fs, dir),
    headSha: (fs, dir) => headSha(iso, fs, dir),
    clone: async (fs, dir, opts) => {
      const repo = new git.LocalRepo(fs as FsClient, dir, http);
      return repo.cloneShallow({
        url: git.relayUrl(window.location.origin, opts.owner, opts.repo),
        ref: opts.ref,
      });
    },
    readWorkingFiles: (fs, dir) =>
      git.readWorkingFiles(fs as FsClient, dir),
    commitFiles: (fs, dir, opts) => {
      const repo = new git.LocalRepo(fs as FsClient, dir);
      return repo.commitFiles(opts.changes, opts.message, identity);
    },
  };
}

/** Build registry operations used by the suggestion modules. */
function projectStore() {
  return {
    get: (id: string) => projectRegistry.get(id),
    setSource: async (id: string, source: ProjectSourceGitHub) => {
      const updated = await projectRegistry.setSource(id, source);
      return { id: updated.id, source };
    },
  };
}

/** Keep the accepted remote version for every conflict by default. */
function acceptedByDefault(paths: string[]): Record<string, SaveConflictChoice> {
  return Object.fromEntries(paths.map((path) => [path, 'theirs' as const]));
}

/** Clone a repository through the BFF relay and read its working files. */
async function cloneRepo(
  git: GitModule,
  http: HttpClient,
  opts: { owner: string; repo: string; ref?: string },
): Promise<SaveClone> {
  const remote = new git.RemoteGit({ http });
  const url = git.relayUrl(window.location.origin, opts.owner, opts.repo);
  const cloned = await remote.clone(url, opts.ref);
  return { sha: cloned.sha, fs: remote.fs, dir: remote.dir };
}

/**
 * Build the dependencies of {@link saveDraft} and the legacy save path.
 *
 * The persistent repository supplies local commits and branch state; the old
 * clone/commit/push hooks remain so submit and restart keep working.
 *
 * @param session - Signed-in viewer used as the commit author.
 * @param resolver - Per-file conflict resolver; accepted versions by default.
 * @returns Repository, remote, registry and conflict dependencies.
 */
export async function createSaveDeps(
  session: BffSession,
  resolver: SaveConflictResolver = (paths) => acceptedByDefault(paths),
): Promise<SaveGitHubDeps> {
  const { git, iso, http } = await loadGit();
  const repoDeps = await createProjectRepoDeps(session);

  return {
    registry: projectStore(),
    getWorkspace: (id) => workspaceManager.get(id),
    clone: (owner, repo, ref) => cloneRepo(git, http, { owner, repo, ref }),
    relayUrl: (owner, repo) => git.relayUrl(window.location.origin, owner, repo),
    readWorkingFiles: (fs, dir) => git.readWorkingFiles(fs as FsClient, dir),
    commitFilesOnBranch: (fs, dir, opts) =>
      git.commitFilesOnBranch(fs as FsClient, dir, opts),
    push: async (fs, dir, url, branch) => {
      const local = new git.LocalRepo(fs as FsClient, dir, http);
      await local.push({ url, ref: branch });
    },
    session,
    openRepo: (project) => openProjectRepo(project, repoDeps),
    commitWorkspace: (id, message) =>
      commitProjectWorkspace(id, message, repoDeps),
    headSha: (fs, dir) => headSha(iso, fs, dir),
    fetch: async (fs, dir, url, branch) => {
      const local = new git.LocalRepo(fs as FsClient, dir, http);
      await local.fetch({ url, ref: branch });
    },
    remoteHead: async (fs, dir, branch) => {
      try {
        return await iso.resolveRef({
          fs: fs as FsClient,
          dir,
          ref: `refs/remotes/origin/${branch}`,
        });
      } catch {
        return null;
      }
    },
    unpushed: async (fs, dir, ref) => {
      const local = new git.LocalRepo(fs as FsClient, dir);
      return local.unpushed(ref);
    },
    rebaseOnto: (opts) => git.rebaseOnto({ ...opts, fs: opts.fs as FsClient }),
    resolveConflicts: resolver,
  };
}

/**
 * Open or clone a project's persistent repository for a draft.
 *
 * The repository is opened through {@link openProjectRepo}, so an existing
 * IndexedDB repository is reused. A fresh draft renames the locally cloned
 * default branch to its placeholder draft branch; a resume checks the remote
 * branch out through the project source.
 *
 * @param project - Project record whose source names the repository.
 * @param branch - Draft branch to check out.
 * @param createBranch - Whether the local draft branch must be created.
 * @param session - Signed-in viewer used to open the repository.
 * @returns Head SHA, checked-out branch and working files of the repository.
 */
export async function prepareProjectDraft(
  project: ProjectRecord,
  branch: string,
  createBranch: boolean,
  session: BffSession,
): Promise<PreparedDraftRepo> {
  const deps = await createProjectRepoDeps(session);
  const repo = await openProjectRepo(project, deps);
  let checkedOut = repo.branch;

  if (createBranch && checkedOut !== branch) {
    const { git } = await loadGit();
    const local = new git.LocalRepo(repo.fs as FsClient, repo.dir);
    await local.renameBranch(checkedOut, branch);
    checkedOut = branch;
  }

  const files = await deps.readWorkingFiles(repo.fs, repo.dir);
  return { sha: repo.sha, branch: checkedOut, files };
}

/**
 * Alias of {@link createProjectRepoDeps} for callers that prefer the shorter
 * suggestion-module naming.
 *
 * @param session - Signed-in viewer used as the commit author.
 * @returns Filesystem, clone, read and commit dependencies.
 */
export function createRepoDeps(session: BffSession): Promise<ProjectRepoDeps> {
  return createProjectRepoDeps(session);
}

export default createProjectRepoDeps;
