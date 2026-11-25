/**
 * Browser wiring for waiting on a newly created fork.
 *
 * The git runtime, its Buffer polyfill and the immutable isomorphic-git HTTP
 * client load lazily on the first wait, so ordinary suggestion starts never pay
 * for git before a fork actually needs polling.
 */

import { waitForFork } from './fork-ready';
import type { SuggestionTarget } from './start';

type GitModule = typeof import('@opendraft/git');
type IsoGit =
  typeof import('../../../../packages/git/node_modules/isomorphic-git/index.js').default;
type HttpClient =
  typeof import('../../../../packages/git/node_modules/isomorphic-git/http/web/index.js').default;

/** Lazily loaded git implementation, raw isomorphic-git and HTTP client. */
interface ForkWaitRuntime {
  /** Isomorphic-git wrapper exports. */
  git: GitModule;
  /** Raw isomorphic-git used to list server refs. */
  iso: IsoGit;
  /** HTTP client used by the remote ref listing. */
  http: HttpClient;
}

/**
 * Load the Buffer polyfill, git implementation and isomorphic-git client.
 *
 * @returns The git module, raw isomorphic-git and its HTTP client.
 */
async function loadGit(): Promise<ForkWaitRuntime> {
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
 * Build a fork waiter that polls the fork's refs through the git relay.
 *
 * @returns A function that resolves once the fork exposes its default branch.
 */
export function createWaitForFork(): (target: SuggestionTarget) => Promise<void> {
  let runtime: Promise<ForkWaitRuntime> | null = null;

  return async (target) => {
    runtime ??= loadGit();
    const { git, iso, http } = await runtime;

    const listRefs = async (
      owner: string,
      repo: string,
      ref: string,
    ): Promise<string[]> => {
      const refs = await iso.listServerRefs({
        http,
        url: git.relayUrl(window.location.origin, owner, repo),
        prefix: ref,
        protocolVersion: 1,
      });
      return refs.map((entry) => entry.ref);
    };

    const sleep = (ms: number): Promise<void> =>
      new Promise((resolve) => setTimeout(resolve, ms));

    await waitForFork(target, { listRefs, sleep });
  };
}
