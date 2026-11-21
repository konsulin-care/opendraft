/**
 * Repository conversion for the reader.
 *
 * Converts a plain GitHub repository into an OpenDraft project by cloning it
 * through the authenticated git relay, scaffolding the manuscript layout and
 * pushing the result onto `opendraft/init`. Depending on push permission and
 * GitHub App installation, the flow either opens a pull request through the
 * BFF or returns a GitHub compare URL against the user's fork.
 *
 * The module is pure: every GitHub, git and workspace operation is injected so
 * it never statically imports `@opendraft/git` or the BFF client.
 */

import { MemoryWorkspace } from '@opendraft/workspace';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import type {
  BffSession,
  ForkResult,
  PullRequestInput,
  PullRequestResult,
  RepoPermissions,
} from '../github/bff-client';

/** Branch that receives the initial OpenDraft project structure. */
export const CONVERT_BRANCH = 'opendraft/init';

/** Commit message used for the initial OpenDraft project structure. */
export const CONVERT_COMMIT_MESSAGE = 'chore: initialize OpenDraft project structure';

/** Title of the pull request that initializes the project. */
export const CONVERT_PR_TITLE = 'Initialize OpenDraft project';

/** Body of the pull request that initializes the project. */
export const CONVERT_PR_BODY =
  'This pull request initializes the OpenDraft project structure for this repository.';

/** Number of clone attempts while a freshly created fork becomes ready. */
const FORK_CLONE_ATTEMPTS = 5;

/** Delay between fork clone attempts, in milliseconds. */
const FORK_CLONE_RETRY_DELAY_MS = 2000;

/** Input of {@link convertRepository}. */
export interface ConvertInput {
  /** Repository owner login. */
  owner: string;
  /** Repository name. */
  repo: string;
  /** Signed-in BFF session identity. */
  session: BffSession;
}

/** A cloned repository filesystem and working directory. */
export interface ClonedRepo {
  /** Git filesystem client used by the commit and push helpers. */
  fs: unknown;
  /** Repository working directory. */
  dir: string;
}

/** Commit request handed to the injected `commitFilesOnBranch`. */
export interface ConvertCommitOptions {
  /** Branch to create and commit on. */
  branch: string;
  /** Repository-relative paths and their contents. */
  files: Map<string, string>;
  /** Commit message. */
  message: string;
  /** Commit author identity. */
  author: { name: string; email: string };
}

/** Injected dependencies of {@link convertRepository}. */
export interface ConvertDeps {
  /** Read permissions and installation state for a repository. */
  getRepoPermissions: (owner: string, repo: string) => Promise<RepoPermissions>;
  /** Fork a repository into the signed-in user's account. */
  forkRepo: (owner: string, repo: string) => Promise<ForkResult>;
  /** Open a pull request on a repository. */
  createPullRequest: (
    owner: string,
    repo: string,
    input: PullRequestInput,
  ) => Promise<PullRequestResult>;
  /** Clone a repository through the authenticated git relay. */
  cloneRepo: (url: string) => Promise<ClonedRepo>;
  /** Build the relay URL for a repository. */
  relayUrl: (owner: string, repo: string) => string;
  /** Push a local branch to a relay URL. */
  push: (fs: unknown, dir: string, url: string, branch: string) => Promise<void>;
  /** Scaffold the OpenDraft project structure into a workspace. */
  scaffold: (ws: WorkspaceAdapter, manuscriptId: string) => Promise<void>;
  /** Commit a file map onto a branch. */
  commitFilesOnBranch: (
    fs: unknown,
    dir: string,
    opts: ConvertCommitOptions,
  ) => Promise<unknown>;
  /** Read all working-tree files of a cloned repository. */
  readWorkingFiles: (fs: unknown, dir: string) => Promise<Map<string, string>>;
  /** Sleep for a number of milliseconds. */
  sleep: (ms: number) => Promise<void>;
}

/** Successful conversion result: an opened PR or a compare URL. */
export type ConvertResult =
  | { kind: 'pr'; url: string }
  | { kind: 'compare'; url: string };

/**
 * Derive a manuscript id from a repository name.
 *
 * Lowercases the name, maps every character outside `[a-z0-9]` to `-`, trims
 * leading and trailing dashes and falls back to `manuscript`.
 *
 * @param repo - Repository name.
 * @returns Manuscript id safe for the scaffold layout.
 */
export function slug(repo: string): string {
  const slugged = repo
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/^-+|-+$/g, '');
  return slugged === '' ? 'manuscript' : slugged;
}

/**
 * Clone a fork, retrying while GitHub finishes creating it.
 *
 * @param deps - Injected dependencies.
 * @param url - Fork relay URL.
 * @returns The cloned filesystem and directory.
 */
async function cloneFork(deps: ConvertDeps, url: string): Promise<ClonedRepo> {
  let lastError: unknown;

  for (let attempt = 0; attempt < FORK_CLONE_ATTEMPTS; attempt += 1) {
    try {
      return await deps.cloneRepo(url);
    } catch (error) {
      lastError = error;
      if (attempt < FORK_CLONE_ATTEMPTS - 1) {
        await deps.sleep(FORK_CLONE_RETRY_DELAY_MS);
      }
    }
  }

  throw lastError;
}

/**
 * Build the GitHub compare URL that proposes the branch from a fork.
 *
 * @param owner - Upstream repository owner.
 * @param repo - Upstream repository name.
 * @param base - Upstream base branch.
 * @param login - Fork owner used as the head repository owner.
 * @returns The prefilled GitHub compare URL.
 */
function compareUrl(owner: string, repo: string, base: string, login: string): string {
  return `https://github.com/${owner}/${repo}/compare/${base}...${login}:${CONVERT_BRANCH}?expand=1`;
}

/**
 * Resolve the clone target and clone it through the relay.
 *
 * Uses the upstream repository when the user can push and the app is
 * installed, otherwise forks the repository and retries the clone while the
 * fork is being created.
 *
 * @param input - Repository owner and name.
 * @param deps - Injected dependencies.
 * @param direct - Whether the upstream repository is the target.
 * @returns The clone target, relay URL and cloned repository.
 */
async function cloneTarget(
  input: ConvertInput,
  deps: ConvertDeps,
  direct: boolean,
): Promise<{ target: { owner: string; repo: string }; url: string; cloned: ClonedRepo }> {
  const target = direct
    ? { owner: input.owner, repo: input.repo }
    : await deps.forkRepo(input.owner, input.repo);
  const url = deps.relayUrl(target.owner, target.repo);
  const cloned = direct ? await deps.cloneRepo(url) : await cloneFork(deps, url);
  return { target, url, cloned };
}

/**
 * Seed a workspace with the working files and scaffold the project into it.
 *
 * @param deps - Injected dependencies.
 * @param fs - Cloned repository filesystem.
 * @param dir - Cloned repository directory.
 * @param manuscriptId - Manuscript id handed to the scaffold.
 * @returns Only the paths created by the scaffold, with their contents.
 */
async function scaffoldFiles(
  deps: ConvertDeps,
  fs: unknown,
  dir: string,
  manuscriptId: string,
): Promise<Map<string, string>> {
  const workingFiles = await deps.readWorkingFiles(fs, dir);
  const existing = new Set(workingFiles.keys());

  const ws = new MemoryWorkspace();
  for (const [path, content] of workingFiles) {
    await ws.writeFile(path, content);
  }

  await deps.scaffold(ws, manuscriptId);

  const files = new Map<string, string>();
  for (const path of await ws.listAll()) {
    if (existing.has(path)) continue;
    files.set(path, (await ws.readFile(path)) ?? '');
  }
  return files;
}

/**
 * Convert a repository into an OpenDraft project.
 *
 * Resolves permissions, then either pushes the scaffold branch to the upstream
 * repository and opens a PR through the BFF, or pushes it to the user's fork
 * and returns the GitHub compare URL. Only paths created by the scaffold are
 * committed, so existing files are never overwritten.
 *
 * @param input - Repository owner, name and the signed-in session.
 * @param deps - Injected GitHub, git and workspace dependencies.
 * @returns A pull request URL or a compare URL, depending on the flow.
 */
export async function convertRepository(
  input: ConvertInput,
  deps: ConvertDeps,
): Promise<ConvertResult> {
  const { owner, repo, session } = input;
  const perms = await deps.getRepoPermissions(owner, repo);
  const direct = perms.push && perms.installed;

  const { url, cloned } = await cloneTarget(input, deps, direct);
  const { fs, dir } = cloned;
  const files = await scaffoldFiles(deps, fs, dir, slug(repo));

  await deps.commitFilesOnBranch(fs, dir, {
    branch: CONVERT_BRANCH,
    files,
    message: CONVERT_COMMIT_MESSAGE,
    author: {
      name: session.name ?? session.login,
      email: `${session.id}+${session.login}@users.noreply.github.com`,
    },
  });

  await deps.push(fs, dir, url, CONVERT_BRANCH);

  if (direct) {
    const pullRequest = await deps.createPullRequest(owner, repo, {
      title: CONVERT_PR_TITLE,
      head: CONVERT_BRANCH,
      base: perms.defaultBranch,
      body: CONVERT_PR_BODY,
    });
    return { kind: 'pr', url: pullRequest.url };
  }

  return {
    kind: 'compare',
    url: compareUrl(owner, repo, perms.defaultBranch, session.login),
  };
}

export default convertRepository;
