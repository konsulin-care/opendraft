import git from 'isomorphic-git';
import type { FsClient, HttpClient } from 'isomorphic-git';

/** Author details used when creating local commits. */
export interface LocalRepoAuthor {
  name: string;
  email: string;
  timestamp?: number;
  timezoneOffset?: number;
}

/** Options for shallow cloning a remote repository. */
export interface CloneShallowOptions {
  url: string;
  ref?: string;
  http?: HttpClient;
}

/** Options for fetching from a remote repository. */
export interface FetchOptions {
  url: string;
  ref?: string;
  http?: HttpClient;
}

/** Options for pushing a local branch to a remote repository. */
export interface PushOptions {
  url: string;
  ref: string;
  remoteRef?: string;
  http?: HttpClient;
}

/** Result of a shallow clone. */
export interface CloneShallowResult {
  sha: string;
  branch: string;
}

const HTTP_REQUIRED = 'LocalRepo remote operations require an HTTP client';

interface RepoPromiseFs {
  writeFile: (filepath: string, data: Uint8Array | string) => Promise<unknown>;
  mkdir: (filepath: string, opts?: { recursive?: boolean }) => Promise<unknown>;
  unlink: (filepath: string) => Promise<unknown>;
}

function joinPath(dir: string, filepath: string): string {
  const base = dir === '/' ? '' : dir.replace(/\/+$/, '');
  return `${base}/${filepath.replace(/^\/+/, '')}`;
}

/** A working-tree file whose HEAD/workdir state differs. */
interface ChangedFile {
  filepath: string;
  head: number;
  workdir: number;
}

async function applyChanges(
  promises: RepoPromiseFs,
  dir: string,
  changes: Map<string, string | null>,
): Promise<void> {
  for (const [filepath, content] of changes) {
    if (content === null) {
      try {
        await promises.unlink(joinPath(dir, filepath));
      } catch {
        // Missing working-tree file: nothing to delete.
      }
      continue;
    }

    const target = joinPath(dir, filepath);
    const parent = target.slice(0, target.lastIndexOf('/'));
    if (parent) {
      try {
        await promises.mkdir(parent, { recursive: true });
      } catch {
        // Parent directory already exists.
      }
    }
    await promises.writeFile(target, content);
  }
}

async function stageChanges(
  fs: FsClient,
  dir: string,
  files: ChangedFile[],
): Promise<void> {
  for (const { filepath, head, workdir } of files) {
    if (workdir === 0) {
      if (head === 1) {
        try {
          await git.remove({ fs, dir, filepath });
        } catch {
          // Already absent from the index.
        }
      }
      continue;
    }
    await git.add({ fs, dir, filepath });
  }
}

/**
 * Local git repository over any isomorphic-git filesystem and directory.
 * Supports local commits, unpushed history discovery, branch renames, and
 * thin remote wrappers that receive an injected HTTP client.
 */
export class LocalRepo {
  private readonly fs: FsClient;
  private readonly dir: string;
  private readonly http?: HttpClient;

  /**
   * Create a local repository handle.
   * @param fs - Isomorphic-git filesystem client.
   * @param dir - Repository directory.
   * @param http - Optional default HTTP client for remote operations.
   */
  constructor(fs: FsClient, dir: string, http?: HttpClient) {
    this.fs = fs;
    this.dir = dir;
    this.http = http;
  }

  /**
   * Write and delete working-tree files, stage them, and create one commit.
   * Returns null without committing when the requested files already match HEAD.
   * @param changes - Map of repository-relative paths to contents; null deletes.
   * @param message - Commit message.
   * @param author - Commit author details.
   * @returns The new commit sha, or null when nothing changed.
   */
  async commitFiles(
    changes: Map<string, string | null>,
    message: string,
    author: LocalRepoAuthor,
  ): Promise<string | null> {
    const promises = (this.fs as unknown as { promises: RepoPromiseFs })
      .promises;
    await applyChanges(promises, this.dir, changes);

    const matrix = await git.statusMatrix({
      fs: this.fs,
      dir: this.dir,
      filter: (filepath) => changes.has(filepath),
    });
    const changed: ChangedFile[] = matrix
      .filter(([, head, workdir]) =>
        head === 0 ? workdir !== 0 : workdir !== 1,
      )
      .map(([filepath, head, workdir]) => ({ filepath, head, workdir }));
    if (changed.length === 0) {
      return null;
    }
    await stageChanges(this.fs, this.dir, changed);
    return git.commit({
      fs: this.fs,
      dir: this.dir,
      message,
      author: {
        name: author.name,
        email: author.email,
        timestamp: author.timestamp ?? Math.floor(Date.now() / 1000),
        timezoneOffset:
          author.timezoneOffset ?? new Date().getTimezoneOffset(),
      },
    });
  }

  /**
   * List local commits not reachable from a remote ref, oldest first.
   * @param remoteRef - Remote branch or ref name, for example origin/main.
   * @returns Commit oids that still need pushing.
   */
  async unpushed(remoteRef: string): Promise<string[]> {
    const history = await git.log({ fs: this.fs, dir: this.dir, ref: 'HEAD' });

    let remoteOid: string | null = null;
    try {
      remoteOid = await git.resolveRef({
        fs: this.fs,
        dir: this.dir,
        ref: remoteRef,
      });
    } catch {
      // No remote ref yet: every local commit is unpushed.
    }

    const unpushed: string[] = [];
    for (const entry of history) {
      if (entry.oid === remoteOid) {
        continue;
      }
      if (remoteOid) {
        const reachable = await git.isDescendent({
          fs: this.fs,
          dir: this.dir,
          oid: remoteOid,
          ancestor: entry.oid,
        });
        if (reachable) {
          continue;
        }
      }
      unpushed.push(entry.oid);
    }

    return unpushed.reverse();
  }

  /**
   * Rename a branch, moving HEAD with it when the branch is currently checked out.
   * @param oldName - Existing branch name.
   * @param newName - New branch name.
   */
  async renameBranch(oldName: string, newName: string): Promise<void> {
    const current = await git.currentBranch({ fs: this.fs, dir: this.dir });
    await git.renameBranch({
      fs: this.fs,
      dir: this.dir,
      oldref: oldName,
      ref: newName,
      checkout: current === oldName,
    });
  }

  /**
   * Shallow-clone a remote repository (depth 1, single branch).
   * @param opts - Remote URL, optional ref, and HTTP client.
   * @returns Cloned HEAD sha and branch name.
   */
  async cloneShallow(opts: CloneShallowOptions): Promise<CloneShallowResult> {
    const http = opts.http ?? this.http;
    if (!http) throw new Error(HTTP_REQUIRED);
    await git.clone({
      fs: this.fs,
      http,
      dir: this.dir,
      url: opts.url,
      ref: opts.ref,
      singleBranch: true,
      depth: 1,
    });

    const sha = await git.resolveRef({
      fs: this.fs,
      dir: this.dir,
      ref: 'HEAD',
    });
    const branch =
      (await git.currentBranch({ fs: this.fs, dir: this.dir })) ??
      opts.ref ??
      '';

    return { sha, branch };
  }

  /**
   * Fetch a remote branch into the local repository.
   * @param opts - Remote URL, optional ref, and HTTP client.
   */
  async fetch(opts: FetchOptions): Promise<void> {
    const http = opts.http ?? this.http;
    if (!http) throw new Error(HTTP_REQUIRED);
    await git.fetch({
      fs: this.fs,
      http,
      dir: this.dir,
      url: opts.url,
      ref: opts.ref,
      singleBranch: opts.ref ? true : undefined,
    });
  }

  /**
   * Push a local branch to the same remote branch.
   * @param opts - Remote URL, branch, optional remote ref, and HTTP client.
   */
  async push(opts: PushOptions): Promise<void> {
    const http = opts.http ?? this.http;
    if (!http) throw new Error(HTTP_REQUIRED);
    await git.push({
      fs: this.fs,
      http,
      dir: this.dir,
      url: opts.url,
      ref: opts.ref,
      remoteRef: opts.remoteRef ?? opts.ref,
    });
  }
}
