/**
 * Manuscript registration for the reader.
 *
 * Registers already discovered manuscript folders in an existing OpenDraft
 * project by appending them to `opendraft.yml`. The commit touches only the
 * project configuration; manuscript files are left untouched. Depending on
 * push permission and GitHub App installation, the flow either opens a pull
 * request through the BFF or returns a GitHub compare URL against the
 * user's fork.
 */

import { MemoryWorkspace } from '@opendraft/workspace';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { applyPlan, discoverProject, planInit } from '@opendraft/manuscript';
import type { InitPlan } from '@opendraft/manuscript';
import type { BffSession } from '../github/bff-client';
import { author, cloneTarget, compareUrl } from './convert';
import type { ClonedRepo, ConvertDeps, ConvertResult } from './convert';

/** Branch that receives the manuscript registration commit. */
export const REGISTER_BRANCH = 'opendraft/register-manuscripts';

/** Commit message used when registering manuscripts. */
export const REGISTER_COMMIT_MESSAGE = 'chore: register OpenDraft manuscripts';

/** Title of the pull request that registers manuscripts. */
export const REGISTER_PR_TITLE = 'Register OpenDraft manuscripts';

/** Input of {@link registerManuscripts}. */
export interface RegisterManuscriptsInput {
  /** Repository owner login. */
  owner: string;
  /** Repository name. */
  repo: string;
  /** Signed-in BFF session identity. */
  session: BffSession;
  /** Registrable candidate ids to append to the project configuration. */
  ids: string[];
}

/**
 * Plan the registration of previously discovered manuscripts.
 *
 * The cloned working tree is loaded into an in-memory workspace so the
 * checkout is never modified. Only the unlisted ids are added; existing
 * entries and the protocol block are preserved.
 *
 * @param deps - Injected dependencies.
 * @param cloned - Cloned repository filesystem and directory.
 * @param ids - Registrable candidate ids to add.
 * @returns The applied plan.
 */
async function applyRegistration(
  deps: ConvertDeps,
  cloned: ClonedRepo,
  ids: string[],
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
    { addUnlisted: ids },
    { protocol: deps.protocol },
  );
  await applyPlan(ws, plan);
  return plan;
}

/**
 * Register manuscript folders in an existing OpenDraft project.
 *
 * Discovers the cloned project, plans the registration of the requested
 * unlisted ids, applies it and commits only the planned files (the config
 * update) on the registration branch. Opens a pull request when the user
 * can push and the app is installed, otherwise pushes to the user's fork
 * and returns the GitHub compare URL.
 *
 * @param input - Repository owner, name, session and candidate ids.
 * @param deps - Injected GitHub, git and workspace dependencies.
 * @returns A pull request URL or a compare URL, depending on the flow.
 */
export async function registerManuscripts(
  input: RegisterManuscriptsInput,
  deps: ConvertDeps,
): Promise<ConvertResult> {
  const { owner, repo, session, ids } = input;
  const perms = await deps.getRepoPermissions(owner, repo);
  const direct = perms.push && perms.installed;

  const { url, cloned } = await cloneTarget(input, deps, direct);
  const { fs, dir } = cloned;
  const plan = await applyRegistration(deps, cloned, ids);

  const files = new Map(
    plan.files
      .filter((file) => file.path === 'opendraft.yml')
      .map((file) => [file.path, file.content]),
  );

  await deps.commitFilesOnBranch(fs, dir, {
    branch: REGISTER_BRANCH,
    files,
    message: REGISTER_COMMIT_MESSAGE,
    author: author(session),
  });

  await deps.push(fs, dir, url, REGISTER_BRANCH);

  if (direct) {
    const pullRequest = await deps.createPullRequest(owner, repo, {
      title: REGISTER_PR_TITLE,
      head: REGISTER_BRANCH,
      base: perms.defaultBranch,
      body: `Register OpenDraft manuscripts: ${plan.registered.join(', ')}`,
    });
    return { kind: 'pr', url: pullRequest.url };
  }

  return {
    kind: 'compare',
    url: compareUrl(owner, repo, perms.defaultBranch, {
      login: session.login,
      branch: REGISTER_BRANCH,
    }),
  };
}

export default registerManuscripts;
