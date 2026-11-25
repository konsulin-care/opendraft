import git from 'isomorphic-git';
import type { HttpClient } from 'isomorphic-git';
import { MemoryFS } from './memory-fs.js';

/** Options for constructing a remote git client. */
export interface RemoteGitOptions {
  http: HttpClient;
  fs?: MemoryFS;
  dir?: string;
}

/** Result of cloning a remote repository. */
export interface CloneResult {
  sha: string;
  branch: string;
}

/**
 * Build the BFF git relay URL for a repository.
 * @param origin - Public origin of the BFF (for example https://publish.konsulin.care).
 * @param owner - Repository owner.
 * @param repo - Repository name.
 * @returns Relay URL ending in .git.
 */
export function relayUrl(origin: string, owner: string, repo: string): string {
  const base = origin.replace(/\/+$/, '');
  return `${base}/@api/git/${owner}/${repo}.git`;
}

/**
 * Git remote operations routed through the BFF relay.
 * Credentials are injected by the BFF; this class never sets Authorization.
 */
export class RemoteGit {
  private readonly http: HttpClient;
  private readonly _fs: MemoryFS;
  private readonly _dir: string;

  /**
   * Create a remote git client.
   * @param opts - Injected HTTP client plus optional filesystem and directory.
   */
  constructor(opts: RemoteGitOptions) {
    this.http = opts.http;
    this._fs = opts.fs ?? new MemoryFS();
    this._dir = opts.dir ?? '/';
  }

  /**
   * The filesystem used by this client.
   */
  get fs(): MemoryFS {
    return this._fs;
  }

  /**
   * The working directory used by this client.
   */
  get dir(): string {
    return this._dir;
  }

  /**
   * Clone a remote repository (single branch, depth 1).
   * @param url - Repository relay URL.
   * @param ref - Optional branch to check out.
   * @returns Resolved HEAD sha and current branch name.
   */
  async clone(url: string, ref?: string): Promise<CloneResult> {
    await git.clone({
      fs: this._fs,
      http: this.http,
      dir: this._dir,
      url,
      ref,
      singleBranch: true,
      depth: 1,
    });

    const sha = await git.resolveRef({ fs: this._fs, dir: this._dir, ref: 'HEAD' });
    const branch = (await git.currentBranch({ fs: this._fs, dir: this._dir })) ?? ref ?? '';

    return { sha, branch };
  }

  /**
   * Push a local branch to the remote repository.
   * @param url - Repository relay URL.
   * @param branch - Branch name to push to the same remote ref.
   */
  async push(url: string, branch: string): Promise<void> {
    await git.push({
      fs: this._fs,
      http: this.http,
      dir: this._dir,
      url,
      ref: branch,
      remoteRef: branch,
    });
  }
}
