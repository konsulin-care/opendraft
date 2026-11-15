#!/usr/bin/env node
/**
 * protocol-history.ts — build the content-addressed protocol revision history.
 * Enumerates every commit touching the protocol TTL glob (same rev-list
 * source as protocol-manifest.ts), hashes each revision's .ttl content with SHA-256 and
 * stores unique content once under `objects`, keyed by digest. Revisions at or
 * after `compatibleSince` carry their file list; older ones are marked
 * incompatible and carry no files. Used to generate the bundled history
 * (packages/rdf/src/protocol-history.generated.json).
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { TTL_GLOB_PATHSPEC, defaultGitOps, type GitOps } from './protocol-manifest';

/** Repository-relative path of the bundled protocol history written by the manifest update. */
export const HISTORY_PATH = 'packages/rdf/src/protocol-history.generated.json';

/** One protocol .ttl file reference: repository path plus SHA-256 of its content. */
export interface HistoryFileRef { path: string; sha256: string; }
/** One revision in the bundled protocol history. */
export interface HistoryRevision {
  /** 40-hex commit SHA, newest first. */
  commit: string;
  /** True when the revision is at or after compatibleSince (always true when compatibleSince is empty). */
  compatible: boolean;
  /** Protocol .ttl files at this revision; present only for compatible revisions. */
  files?: HistoryFileRef[];
}
/** The bundled protocol history document. */
export interface ProtocolHistory {
  /** Newest commit touching the protocol TTL glob (git rev-list). */
  latest: string;
  /** compatibleSince echoed from the input; empty string when absent. */
  compatibleSince: string;
  /** Revisions newest-first. */
  revisions: HistoryRevision[];
  /** Content-addressed store: SHA-256 hex digest -> unique file content (utf8). */
  objects: Record<string, string>;
}
/** Options accepted by buildProtocolHistory. */
export interface ProtocolHistoryOptions {
  /** 40-hex revision from which revisions stay compatible; absent/empty marks every revision compatible. */
  compatibleSince?: string;
}
/**
 * Git operations for history building: the shared manifest GitOps plus
 * revision enumeration, per-revision file listing and pairwise ancestry.
 */
export interface HistoryGitOps extends GitOps {
  /** Commits touching the protocol TTL glob, newest first (git rev-list HEAD over the manifest pathspec). */
  ttlCommits(): string[];
  /** Sorted protocol .ttl paths present at the given commit (`git ls-tree -r --name-only <commit> -- pathspec`). */
  ttlPathsAt(commit: string): string[];
  /** Whether `commit` is an ancestor-or-self of `revision` (or of HEAD when `revision` is omitted). */
  isAncestorOrSelf(commit: string, revision?: string): boolean;
}

/**
 * Builds the content-addressed protocol history from git.
 * @param gitOps - Git operations used to enumerate revisions and read content.
 * @param options - Options carrying the optional compatibleSince revision.
 * @returns The history: latest revision, echoed compatibleSince, revisions and deduplicated objects.
 */
export function buildProtocolHistory(gitOps: HistoryGitOps, options: ProtocolHistoryOptions): ProtocolHistory {
  const since = options.compatibleSince ?? '';
  const gated = since.trim().length > 0;
  const revisions: HistoryRevision[] = [];
  const objects: Record<string, string> = {};
  for (const commit of gitOps.ttlCommits()) {
    const compatible = !gated || gitOps.isAncestorOrSelf(since, commit);
    const revision: HistoryRevision = { commit, compatible };
    if (compatible) {
      const files: HistoryFileRef[] = [];
      for (const path of gitOps.ttlPathsAt(commit)) {
        const content = gitOps.readCommitFile(commit, path);
        const sha256 = createHash('sha256').update(content).digest('hex');
        if (!(sha256 in objects)) objects[sha256] = content.toString('utf8');
        files.push({ path, sha256 });
      }
      revision.files = files;
    }
    revisions.push(revision);
  }
  return { latest: gitOps.lastTtlCommit(), compatibleSince: since, revisions, objects };
}

/**
 * Git operations backed by the repository at the given working directory.
 * Composes the manifest GitOps with full rev-list enumeration and
 * two-argument ancestry, all sourced from the manifest's TTL pathspec.
 * @param dir - Repository working directory.
 * @returns HistoryGitOps bound to that repository.
 */
export function defaultHistoryGitOps(dir: string): HistoryGitOps {
  const base = defaultGitOps(dir);
  const run = (args: string[]): Buffer => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
  const lines = (args: string[]): string[] =>
    run(args).toString('utf8').split('\n').filter((line) => line.length > 0);
  return {
    ...base,
    ttlCommits: () => lines(['rev-list', 'HEAD', '--', TTL_GLOB_PATHSPEC]),
    ttlPathsAt: (commit) =>
      lines(['ls-tree', '-r', '--name-only', commit, '--', 'protocol'])
        .filter((path) => path.endsWith('.ttl'))
        .sort(),
    isAncestorOrSelf: (commit, revision) => {
      try {
        run(['merge-base', '--is-ancestor', commit, revision ?? 'HEAD']);
        return true;
      } catch {
        return false;
      }
    },
  };
}
