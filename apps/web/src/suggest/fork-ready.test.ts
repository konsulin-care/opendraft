/**
 * Fork readiness tests: polling the fork's refs with backoff and the typed
 * timeout error once the wait budget is exhausted.
 */
import { describe, expect, it, vi } from 'vitest';
import { ForkPendingError, waitForFork } from './fork-ready';
import type { ForkReadyTarget, WaitForForkDeps } from './fork-ready';

const target: ForkReadyTarget = {
  owner: 'OctoCat',
  repo: 'draft',
  defaultBranch: 'main',
};

/** Build deps whose listRefs follows a scripted sequence of outcomes. */
function scriptedDeps(outcomes: Array<string[] | Error>) {
  let call = 0;
  const listRefs = vi.fn<WaitForForkDeps['listRefs']>(async () => {
    const outcome = outcomes[Math.min(call, outcomes.length - 1)];
    call += 1;
    if (outcome instanceof Error) throw outcome;
    return outcome;
  });
  const sleep = vi.fn<WaitForForkDeps['sleep']>(async () => undefined);
  const deps: WaitForForkDeps = { listRefs, sleep };
  return { deps, listRefs, sleep };
}

describe('waitForFork', () => {
  it('resolves without sleeping when the default branch already exists', async () => {
    const { deps, listRefs, sleep } = scriptedDeps([
      ['refs/heads/main', 'refs/heads/od-other'],
    ]);

    await waitForFork(target, deps);

    expect(listRefs).toHaveBeenCalledTimes(1);
    expect(listRefs).toHaveBeenCalledWith('OctoCat', 'draft', 'refs/heads/main');
    expect(sleep).not.toHaveBeenCalled();
  });

  it('treats empty results and rejections as not ready and backs off', async () => {
    const { deps, sleep } = scriptedDeps([
      [],
      new Error('404 not found'),
      [],
      ['refs/heads/main'],
    ]);

    await waitForFork(target, deps);

    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000, 4000]);
  });

  it('throws ForkPendingError when the 60000 ms budget is exhausted', async () => {
    const { deps, sleep } = scriptedDeps([[]]);

    const error = await waitForFork(target, deps).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ForkPendingError);
    expect((error as Error).name).toBe('ForkPendingError');
    expect((error as Error).message).toBe(
      'GitHub is still creating your fork. Try again in a moment.',
    );
    expect(sleep.mock.calls.reduce((sum, [ms]) => sum + ms, 0)).toBeLessThanOrEqual(
      60_000,
    );
  });
});
