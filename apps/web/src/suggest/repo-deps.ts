/**
 * Browser wiring for the persistent project repository.
 *
 * Kept separate from `browser-deps.ts` so the suggestion flow can grow without
 * pushing that file over the size limit. Git, its Buffer polyfill and the
 * isomorphic-git HTTP client load lazily, so ordinary editor pages never pay
 * for git until a project repository is opened.
 */

import { workspaceManager } from '@opendraft/workspace';
import type { FsClient } from '../../../../packages/git/node_modules/isomorphic-git/index.js';
import type { HttpClient } from '../../../../packages/git/node_modules/isomorphic-git/http/web/index.js';
import type { BffSession } from '../github/bff-client';
import { author } from '../reader/convert';
import type { ProjectRepoDeps } from './project-repo';

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
