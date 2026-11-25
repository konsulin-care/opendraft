/**
 * Wait for GitHub to finish creating a fork.
 *
 * Fork creation is asynchronous: a freshly created fork can 404 or return no
 * refs for a while. The browser polls the fork's refs through the existing git
 * relay until the default branch exists, backing off between attempts.
 */

/** Total time the caller is willing to wait for a fork, in milliseconds. */
const FORK_READY_BUDGET_MS = 60_000;

/** Delay per retry, in milliseconds; the last entry repeats. */
const FORK_READY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000] as const;

/** Thrown when a fork is still being created after the wait budget. */
export class ForkPendingError extends Error {
  /** Create the typed timeout error with its fixed message. */
  constructor() {
    super('GitHub is still creating your fork. Try again in a moment.');
    this.name = 'ForkPendingError';
  }
}

/** The fork to wait for. */
export interface ForkReadyTarget {
  /** Owner of the fork. */
  owner: string;
  /** Name of the fork. */
  repo: string;
  /** Branch that must exist before the fork counts as ready. */
  defaultBranch: string;
}

/** Injected dependencies of {@link waitForFork}. */
export interface WaitForForkDeps {
  /** List the refs of a repository, rejecting while the fork is unavailable. */
  listRefs: (owner: string, repo: string, ref: string) => Promise<string[]>;
  /** Pause for the given number of milliseconds. */
  sleep: (ms: number) => Promise<void>;
}

/** Return the delay for a retry index, repeating the last value. */
function delayFor(retry: number): number {
  const index = Math.min(retry, FORK_READY_DELAYS_MS.length - 1);
  return FORK_READY_DELAYS_MS[index];
}

/**
 * Wait until a fork exposes its default branch.
 *
 * @param target - Owner, repo and default branch of the fork.
 * @param deps - Ref listing and sleep implementations.
 * @returns Resolves once the default branch ref exists.
 * @throws {ForkPendingError} When the 60000 ms budget is exhausted.
 */
export async function waitForFork(
  target: ForkReadyTarget,
  deps: WaitForForkDeps,
): Promise<void> {
  const ref = `refs/heads/${target.defaultBranch}`;
  let slept = 0;
  let retry = 0;

  for (;;) {
    const ready = await deps
      .listRefs(target.owner, target.repo, ref)
      .then((refs) => refs.includes(ref))
      .catch(() => false);
    if (ready) return;

    const delay = delayFor(retry);
    if (slept + delay > FORK_READY_BUDGET_MS) {
      throw new ForkPendingError();
    }
    await deps.sleep(delay);
    slept += delay;
    retry += 1;
  }
}
