/**
 * Publish a local project as a new GitHub repository.
 *
 * The repository is created through the BFF, a persistent project repository is
 * initialized on `main`, every suggestion-scoped workspace file becomes the
 * first commit, and that commit is pushed directly to the default branch. The
 * only direct default-branch push is this initial publish; later drafts always
 * live on `od-<login>/...` branches.
 */

import type {
  ProjectRecord,
  ProjectSourceGitHub,
  WorkspaceAdapter,
} from '@opendraft/workspace';
import type {
  BffSession,
  CreateRepoInput,
  CreateRepoResult,
} from '../github/bff-client';
import { BffError } from '../github/bff-client';
import { author } from '../reader/convert';
import { fileDigest, isSuggestionPath } from './file-diff';

/** Branch that receives the first commit of a published project. */
export const PUBLISH_BRANCH = 'main';

/** Commit message of the initial manuscript import. */
export const PUBLISH_COMMIT_MESSAGE = 'Initial OpenDraft manuscript';

/** Target repository chosen in the publish dialog. */
export interface PublishTarget {
  /** Owner login receiving the repository. */
  owner: string;
  /** Whether the owner is the signed-in user rather than an organization. */
  ownerIsUser: boolean;
  /** Repository name. */
  name: string;
  /** Whether the repository is private. */
  private: boolean;
}

/** Persistent repository opened for the first commit. */
export interface PublishRepo {
  /** Git filesystem client. */
  fs: unknown;
  /** Repository working directory. */
  dir: string;
}

/** Commit request handed to the injected commit operation. */
export interface PublishCommitOptions {
  /** Branch that receives the commit. */
  branch: string;
  /** Repository-relative paths and their contents. */
  files: Map<string, string>;
  /** Commit message. */
  message: string;
  /** Commit author identity. */
  author: { name: string; email: string };
}

/** Registry operations needed by {@link publishProject}. */
export interface PublishRegistry {
  /** Read an existing project record. */
  get: (id: string) => Promise<ProjectRecord | undefined>;
  /** Replace the project source after publishing. */
  setSource: (
    id: string,
    source: ProjectSourceGitHub,
  ) => Promise<unknown>;
}

/** Injected dependencies of {@link publishProject}. */
export interface PublishProjectDeps {
  /** Project registry used to load and update the project. */
  registry: PublishRegistry;
  /** Open the workspace of a project id. */
  getWorkspace: (id: string) => Promise<WorkspaceAdapter>;
  /** Create the repository through the BFF. */
  createRepo: (input: CreateRepoInput) => Promise<CreateRepoResult>;
  /** Initialize the project's persistent repository on a branch. */
  initRepo: (projectId: string, branch: string) => Promise<PublishRepo>;
  /** Write files onto a branch and commit them. */
  commitFiles: (
    fs: unknown,
    dir: string,
    opts: PublishCommitOptions,
  ) => Promise<string>;
  /** Push a local branch to a relay URL. */
  push: (fs: unknown, dir: string, url: string, branch: string) => Promise<void>;
  /** Build the relay URL of the created repository. */
  relayUrl: (owner: string, repo: string) => string;
  /** Signed-in viewer used as the commit author. */
  session: BffSession;
}

/**
 * Read the suggestion-scoped files of a workspace.
 *
 * @param workspace - Project workspace.
 * @returns Map of repository-relative path to content.
 */
async function readScopedFiles(
  workspace: WorkspaceAdapter,
): Promise<Map<string, string>> {
  const files = new Map<string, string>();

  for (const path of await workspace.listAll()) {
    if (!isSuggestionPath(path)) continue;
    const content = await workspace.readFile(path);
    if (content !== null) files.set(path, content);
  }

  return files;
}

/**
 * Create the repository, translating a permission failure into plain language.
 *
 * @param target - Owner and name of the new repository.
 * @param deps - Injected repository creation.
 * @returns The created repository answer.
 * @throws Error with an actionable message when the viewer cannot create repos.
 */
async function createRepository(
  target: PublishTarget,
  deps: PublishProjectDeps,
): Promise<CreateRepoResult> {
  try {
    return await deps.createRepo({
      owner: target.owner,
      name: target.name,
      visibility: target.private ? 'private' : 'public',
    });
  } catch (error) {
    if (error instanceof BffError && error.status === 403) {
      throw new Error(
        `You don't have permission to create repositories in ${target.owner}.`,
        { cause: error },
      );
    }
    throw error;
  }
}

/**
 * Build the GitHub source of a freshly published project.
 *
 * @param target - Owner, name and visibility chosen at publish time.
 * @param syncedSha - Commit pushed to the default branch.
 * @param files - Scoped files used for the per-file digest.
 * @returns The source stored on the project record.
 */
function buildSource(
  target: PublishTarget,
  syncedSha: string,
  files: ReadonlyMap<string, string>,
): ProjectSourceGitHub {
  return {
    kind: 'github',
    owner: target.owner,
    repo: target.name,
    branch: PUBLISH_BRANCH,
    upstream: {
      owner: target.owner,
      repo: target.name,
      defaultBranch: PUBLISH_BRANCH,
    },
    private: target.private,
    pushed: true,
    pullNumber: null,
    syncedSha,
    digest: fileDigest(files),
  };
}

/**
 * Publish a local project as a new GitHub repository.
 *
 * Repository creation happens first, so a permission or naming failure leaves
 * the project untouched. The first commit contains every suggestion-scoped
 * workspace file and is pushed straight to `main`; the project source then
 * points at its own repository.
 *
 * @param projectId - Local project to publish.
 * @param target - Owner, name and visibility of the new repository.
 * @param deps - Injected BFF, git, workspace and registry dependencies.
 * @returns The GitHub source stored on the project.
 * @throws Error when the project does not exist or repository creation fails.
 */
export async function publishProject(
  projectId: string,
  target: PublishTarget,
  deps: PublishProjectDeps,
): Promise<ProjectSourceGitHub> {
  const project = await deps.registry.get(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  await createRepository(target, deps);

  const repo = await deps.initRepo(projectId, PUBLISH_BRANCH);
  const files = await readScopedFiles(await deps.getWorkspace(projectId));
  const sha = await deps.commitFiles(repo.fs, repo.dir, {
    branch: PUBLISH_BRANCH,
    files,
    message: PUBLISH_COMMIT_MESSAGE,
    author: author(deps.session),
  });
  await deps.push(
    repo.fs,
    repo.dir,
    deps.relayUrl(target.owner, target.name),
    PUBLISH_BRANCH,
  );

  const source = buildSource(target, sha, files);
  await deps.registry.setSource(projectId, source);
  return source;
}

export default publishProject;
