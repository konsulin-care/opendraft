import git from 'isomorphic-git';
import type { FsClient, MergeDriverCallback } from 'isomorphic-git';

/** Per-file conflict resolution: keep the replayed commit or the accepted side. */
export type RebaseResolution = 'mine' | 'theirs';

/** Options for rebasing commits from one ref onto another. */
export interface RebaseOntoOptions {
  fs: FsClient;
  dir: string;
  branch: string;
  onto: string;
  from: string;
  resolve: (
    paths: string[],
  ) => Promise<Record<string, RebaseResolution>> | Record<string, RebaseResolution>;
}

/** Result of a successful rebase. */
export interface RebaseOntoResult {
  tip: string;
  backup: string;
}

/** Error shape thrown by isomorphic-git merge conflicts. */
interface MergeErrorLike {
  code: string;
  data?: { filepaths?: string[] };
}

/**
 * Normalize a branch name into its full refs/heads form.
 * @param branch - Branch name or full ref.
 * @returns Fully qualified branch ref.
 */
function branchRef(branch: string): string {
  return branch.startsWith('refs/') ? branch : `refs/heads/${branch}`;
}

/**
 * Strip the refs/heads prefix so a branch can be used in backup ref names.
 * @param branch - Branch name or full ref.
 * @returns Short branch name.
 */
function shortBranch(branch: string): string {
  return branch.replace(/^refs\/heads\//, '').replace(/^refs\//, '');
}

/**
 * Check whether an error is a cherry-pick merge failure.
 * @param error - Thrown value.
 * @returns True for MergeConflictError and MergeNotSupportedError.
 */
function isMergeError(error: unknown): error is MergeErrorLike {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }
  const code = (error as { code: unknown }).code;
  return code === 'MergeConflictError' || code === 'MergeNotSupportedError';
}

/**
 * Collect conflicting paths from a merge error.
 * @param error - Merge error thrown by cherry-pick.
 * @returns Conflicting repository-relative paths.
 */
function conflictPaths(error: MergeErrorLike): string[] {
  return Array.isArray(error.data?.filepaths) ? error.data.filepaths : [];
}

/**
 * Create a merge driver that resolves every conflicted path from the choices.
 * `contents[1]` is the accepted (onto) side and `contents[2]` is the replayed
 * commit (mine). Unlisted paths default to the replayed commit.
 * @param choices - Per-path resolution decisions.
 * @returns Merge driver callback for isomorphic-git.
 */
function createMergeDriver(
  choices: Record<string, RebaseResolution>,
): MergeDriverCallback {
  return ({ contents, path }) => {
    const mergedText =
      choices[path] === 'theirs' ? contents[1] : contents[2];
    return { cleanMerge: true, mergedText };
  };
}

/**
 * List oids reachable from a ref but not from another ref, oldest first.
 * @param fs - Isomorphic-git filesystem client.
 * @param dir - Repository directory.
 * @param targetRef - Branch ref to walk.
 * @param from - Commit or ref that bounds the replay.
 * @returns Commit oids after `from`, oldest first.
 */
async function listReplayOids(
  fs: FsClient,
  dir: string,
  targetRef: string,
  from: string,
): Promise<string[]> {
  const fromOid = await git.resolveRef({ fs, dir, ref: from });
  const history = await git.log({ fs, dir, ref: targetRef });
  const fromIndex = history.findIndex((entry) => entry.oid === fromOid);
  return (fromIndex === -1 ? history : history.slice(0, fromIndex))
    .map((entry) => entry.oid)
    .reverse();
}

/**
 * Cherry-pick one commit, retrying with a merge driver after conflicts.
 * @param fs - Isomorphic-git filesystem client.
 * @param dir - Repository directory.
 * @param oid - Commit to replay.
 * @param resolve - Per-path conflict resolver.
 */
async function cherryPickWithResolution(
  fs: FsClient,
  dir: string,
  oid: string,
  resolve: RebaseOntoOptions['resolve'],
): Promise<void> {
  const { commit } = await git.readCommit({ fs, dir, oid });
  const committer = {
    name: commit.author.name,
    email: commit.author.email,
    timestamp: commit.author.timestamp,
    timezoneOffset: commit.author.timezoneOffset,
  };

  try {
    await git.cherryPick({
      fs,
      dir,
      oid,
      committer,
      abortOnConflict: true,
    });
  } catch (error) {
    if (!isMergeError(error)) {
      throw error;
    }
    const choices = await resolve(conflictPaths(error));
    await git.cherryPick({
      fs,
      dir,
      oid,
      committer,
      abortOnConflict: true,
      mergeDriver: createMergeDriver(choices),
    });
  }
}

/** Options for restoring a branch after a failed rebase. */
interface RestoreBranchOptions {
  fs: FsClient;
  dir: string;
  branch: string;
  targetRef: string;
  originalTip: string;
  tempBranch: string;
}

/**
 * Point a branch back at its original tip and clean up the temp branch.
 * @param opts - Branch, original tip, and temporary branch state.
 */
async function restoreBranch(opts: RestoreBranchOptions): Promise<void> {
  const { fs, dir, branch, targetRef, originalTip, tempBranch } = opts;
  await git.writeRef({
    fs,
    dir,
    ref: targetRef,
    value: originalTip,
    force: true,
  });
  try {
    await git.checkout({ fs, dir, ref: shortBranch(branch), force: true });
  } catch {
    // Restoring the ref is the critical part; checkout is best effort.
  }
  await deleteTempBranch(fs, dir, tempBranch);
}

/**
 * Delete the temporary rebase branch without failing the rebase.
 * @param fs - Isomorphic-git filesystem client.
 * @param dir - Repository directory.
 * @param tempBranch - Temporary branch name.
 */
async function deleteTempBranch(
  fs: FsClient,
  dir: string,
  tempBranch: string,
): Promise<void> {
  try {
    await git.deleteBranch({ fs, dir, ref: tempBranch });
  } catch {
    // Temporary branch cleanup is best effort.
  }
}

/** Coordinates shared by the replay and restore phases. */
interface ReplayState {
  targetRef: string;
  tempBranch: string;
}

/**
 * Create a temp branch at `onto`, replay commits onto it, then move `branch`.
 * @param opts - Filesystem, repository, branch, source refs, and resolver.
 * @param state - Fully qualified target ref and temporary branch name.
 */
async function replayOnto(
  opts: RebaseOntoOptions,
  state: ReplayState,
): Promise<void> {
  const { fs, dir, branch, onto, from, resolve } = opts;
  const { targetRef, tempBranch } = state;
  const ontoOid = await git.resolveRef({ fs, dir, ref: onto });
  const replay = await listReplayOids(fs, dir, targetRef, from);

  await git.branch({
    fs,
    dir,
    ref: tempBranch,
    object: ontoOid,
    checkout: true,
    force: true,
  });

  for (const oid of replay) {
    await cherryPickWithResolution(fs, dir, oid, resolve);
  }

  const tip = await git.resolveRef({ fs, dir, ref: 'HEAD' });
  await git.writeRef({ fs, dir, ref: targetRef, value: tip, force: true });
  await git.checkout({ fs, dir, ref: shortBranch(branch), force: true });
  await deleteTempBranch(fs, dir, tempBranch);
}

/**
 * Rebase commits from `from`..`branch` onto `onto`, emulating
 * `git rebase --onto <onto> <from> <branch>`.
 *
 * The original branch tip is saved to `refs/od-backup/<branch>` before
 * replaying. Conflicts are resolved per path through the injected callback.
 * The branch is restored to the backup tip when any step fails.
 * @param opts - Filesystem, repository, branch, source refs, and resolver.
 * @returns The new branch tip and the backup ref it replaced.
 */
export async function rebaseOnto(
  opts: RebaseOntoOptions,
): Promise<RebaseOntoResult> {
  const { fs, dir, branch } = opts;
  const targetRef = branchRef(branch);
  const originalTip = await git.resolveRef({ fs, dir, ref: targetRef });
  await git.writeRef({
    fs,
    dir,
    ref: `refs/od-backup/${shortBranch(branch)}`,
    value: originalTip,
    force: true,
  });

  const tempBranch = `od-rebase-${Date.now()}`;
  try {
    await replayOnto(opts, { targetRef, tempBranch });
    const tip = await git.resolveRef({ fs, dir, ref: targetRef });
    return { tip, backup: originalTip };
  } catch (error) {
    await restoreBranch({
      fs,
      dir,
      branch,
      targetRef,
      originalTip,
      tempBranch,
    });
    throw error;
  }
}
