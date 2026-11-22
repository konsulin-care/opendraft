/**
 * Repository conversion for the reader.
 *
 * Clones a GitHub repository, discovers existing manuscripts, plans the
 * project initialization and pushes the result onto `opendraft/init`. Every
 * GitHub, git and workspace operation is injected so the module never
 * statically imports `@opendraft/git` or the BFF client.
 */

import { MemoryWorkspace } from '@opendraft/workspace';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import {
  applyPlan,
  discoverProject,
  normalizeManuscriptId,
  planInit,
} from '@opendraft/manuscript';
import type {
  InitDecisions,
  InitPlan,
  ProjectDiscovery,
  ProtocolBlock,
} from '@opendraft/manuscript';
import type {
  BffSession,
  ForkResult,
  PullRequestInput,
  PullRequestResult,
  RepoPermissions,
} from '../github/bff-client';
import { buildPrBody } from './convert-plan';

/** Branch that receives the initial OpenDraft project structure. */
export const CONVERT_BRANCH = 'opendraft/init';

/** Commit message used for the initial OpenDraft project structure. */
export const CONVERT_COMMIT_MESSAGE = 'chore: initialize OpenDraft project structure';

/** Title of the pull request that initializes the project. */
export const CONVERT_PR_TITLE = 'Initialize OpenDraft project';

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
  /** Optional registration decisions; defaults to registering every manuscript. */
  decisions?: InitDecisions;
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
  /** Protocol block written into a new or updated project configuration. */
  protocol: ProtocolBlock;
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
 * Register every candidate, or ask for a new manuscript named after the repo.
 *
 * @param discovery - Read-only project discovery result.
 * @param repo - Repository name used for the new manuscript id.
 * @returns Decisions handed to `planInit`.
 */
function defaultDecisions(discovery: ProjectDiscovery, repo: string): InitDecisions {
  const registrable = discovery.candidates
    .filter((candidate) => candidate.status === 'valid' || candidate.status === 'repairable')
    .map((candidate) => candidate.id);
  if (registrable.length > 0) return { register: registrable };
  return { newManuscriptId: normalizeManuscriptId(repo) };
}

/** Clone a fork, retrying while GitHub finishes creating it. */
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
 * Build the GitHub compare URL that proposes a branch from a fork.
 *
 * @param owner - Upstream repository owner.
 * @param repo - Upstream repository name.
 * @param base - Upstream base branch.
 * @param head - Fork login and optional head branch.
 * @returns The prefilled GitHub compare URL.
 */
export function compareUrl(
  owner: string,
  repo: string,
  base: string,
  head: { login: string; branch?: string },
): string {
  const branch = head.branch ?? CONVERT_BRANCH;
  return `https://github.com/${owner}/${repo}/compare/${base}...${head.login}:${branch}?expand=1`;
}

/**
 * Build the commit author identity from the signed-in session.
 *
 * @param session - Signed-in BFF session identity.
 * @returns Name and noreply email used for commits.
 */
export function author(session: BffSession): { name: string; email: string } {
  return {
    name: session.name ?? session.login,
    email: `${session.id}+${session.login}@users.noreply.github.com`,
  };
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
export async function cloneTarget(
  input: { owner: string; repo: string },
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
 * Load the cloned working files, plan the project initialization and apply it.
 *
 * The plan is applied to an in-memory copy of the working tree so the cloned
 * checkout is left untouched; only the planned files are handed to the commit.
 *
 * @param deps - Injected dependencies.
 * @param cloned - Cloned repository filesystem and directory.
 * @param repo - Repository name used for the default new manuscript id.
 * @param decisions - Optional caller decisions; defaults are derived on a miss.
 * @returns The applied plan.
 */
async function applyInit(
  deps: ConvertDeps,
  cloned: ClonedRepo,
  repo: string,
  decisions: InitDecisions | undefined,
): Promise<InitPlan> {
  const workingFiles = await deps.readWorkingFiles(cloned.fs, cloned.dir);
  const ws: WorkspaceAdapter = new MemoryWorkspace();
  for (const [path, content] of workingFiles) {
    await ws.writeFile(path, content);
  }

  const discovery = await discoverProject(ws);
  const plan = await planInit(
    ws,
    discovery,
    decisions ?? defaultDecisions(discovery, repo),
    { protocol: deps.protocol },
  );
  await applyPlan(ws, plan);
  return plan;
}

/**
 * Convert a repository into an OpenDraft project.
 *
 * Resolves permissions, then discovers existing manuscripts in the clone,
 * plans and applies the initialization, pushes the branch to the upstream
 * repository and opens a PR through the BFF, or pushes it to the user's fork
 * and returns the GitHub compare URL. Exactly the planned files are committed,
 * so existing manuscript files are never overwritten.
 *
 * @param input - Repository owner, name, session and optional decisions.
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
  const plan = await applyInit(deps, cloned, repo, input.decisions);

  const files = new Map(plan.files.map((file) => [file.path, file.content]));

  await deps.commitFilesOnBranch(fs, dir, {
    branch: CONVERT_BRANCH,
    files,
    message: CONVERT_COMMIT_MESSAGE,
    author: author(session),
  });

  await deps.push(fs, dir, url, CONVERT_BRANCH);

  if (direct) {
    const pullRequest = await deps.createPullRequest(owner, repo, {
      title: CONVERT_PR_TITLE,
      head: CONVERT_BRANCH,
      base: perms.defaultBranch,
      body: buildPrBody(plan),
    });
    return { kind: 'pr', url: pullRequest.url };
  }

  return {
    kind: 'compare',
    url: compareUrl(owner, repo, perms.defaultBranch, { login: session.login }),
  };
}

export default convertRepository;
