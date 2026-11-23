import git from 'isomorphic-git';
import type { FsClient } from 'isomorphic-git';

/**
 * Ensure a branch exists and is checked out.
 * Creates the branch at the current HEAD commit when missing, checks out an
 * existing non-current branch, and is a no-op when the branch is already current.
 * @param fs - Isomorphic-git filesystem client.
 * @param dir - Repository directory.
 * @param branch - Branch name to ensure and check out.
 * @returns The branch name that is checked out.
 */
export async function ensureBranch(
  fs: FsClient,
  dir: string,
  branch: string,
): Promise<string> {
  const current = await git.currentBranch({ fs, dir, fullname: false });
  if (current === branch) {
    return branch;
  }

  const branches = await git.listBranches({ fs, dir });
  if (branches.includes(branch)) {
    await git.checkout({ fs, dir, ref: branch });
    return branch;
  }

  await git.branch({ fs, dir, ref: branch, checkout: true });
  return branch;
}
