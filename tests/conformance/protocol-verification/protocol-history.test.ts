import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildProtocolHistory, type HistoryGitOps } from '../../../scripts/protocol-history';

/** Newest commit in the fake rev-list (git rev-list HEAD -- protocol glob pathspec). */
const NEWEST = 'a'.repeat(40);
/** Middle commit; used as compatibleSince in the gated tests. */
const MIDDLE = 'b'.repeat(40);
/** Oldest commit; older than compatibleSince. */
const OLDEST = 'c'.repeat(40);
/** Fake rev-list output, newest first. */
const REV_LIST = [NEWEST, MIDDLE, OLDEST];
/** Shared artifact unchanged between NEWEST and MIDDLE. */
const SHARED = '# shared vocab\n';
/** Per-revision content of the second artifact. */
const ARTICLE_V2 = '# article v2\n';
const ARTICLE_V1 = '# article v1\n';
/** Content of the oldest revision's artifact, read only when ungated. */
const ANCIENT = '# ancient vocab\n';

/** SHA-256 hex digest of a utf8 string, matching the implementation's hashing. */
function sha(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/** Content served for (revision, path); OLDEST content must never be read. */
function contentAt(commit: string, path: string): Buffer {
  if (commit === NEWEST && path === 'protocol/opendraft.ttl') return Buffer.from(SHARED);
  if (commit === MIDDLE && path === 'protocol/opendraft.ttl') return Buffer.from(SHARED);
  if (commit === NEWEST && path === 'protocol/article.shacl.ttl') return Buffer.from(ARTICLE_V2);
  if (commit === MIDDLE && path === 'protocol/article.shacl.ttl') return Buffer.from(ARTICLE_V1);
  if (commit === OLDEST && path === 'protocol/opendraft.ttl') return Buffer.from(ANCIENT);
  throw new Error(`unexpected read of ${path} at ${commit}`);
}

/** GitOps double following the manifest-update-check fakeGitOps pattern. */
function fakeGitOps(overrides: Partial<HistoryGitOps> = {}): HistoryGitOps {
  return {
    lastTtlCommit: () => NEWEST,
    ttlTreeClean: () => true,
    readCommitFile: (commit: string, path: string) => contentAt(commit, path),
    commitExists: () => true,
    ttlCommits: () => [...REV_LIST],
    ttlPathsAt: (commit) => (commit === OLDEST ? ['protocol/opendraft.ttl'] : ['protocol/article.shacl.ttl', 'protocol/opendraft.ttl']),
    // Linear history: `since` is ancestor-or-self of `revision` iff it is not newer than it.
    isAncestorOrSelf: (since: string, revision?: string) =>
      REV_LIST.indexOf(since) >= REV_LIST.indexOf(revision ?? NEWEST),
    ...overrides,
  };
}

describe('buildProtocolHistory — content-addressed objects', () => {
  it('stores identical artifact content once under its sha256 for revisions at or after compatibleSince', () => {
    const history = buildProtocolHistory(fakeGitOps(), { compatibleSince: MIDDLE });
    const files = history.revisions.flatMap((revision) => revision.files ?? []);
    // The shared artifact is referenced by both compatible revisions...
    const sharedRefs = files.filter((file) => file.sha256 === sha(SHARED));
    expect(sharedRefs.map((file) => file.path)).toEqual(['protocol/opendraft.ttl', 'protocol/opendraft.ttl']);
    // ...but stored only once, alongside the two distinct article contents.
    expect(Object.keys(history.objects).sort()).toEqual(
      [sha(SHARED), sha(ARTICLE_V2), sha(ARTICLE_V1)].sort(),
    );
    expect(history.objects[sha(SHARED)]).toBe(SHARED);
    expect(history.objects[sha(ARTICLE_V2)]).toBe(ARTICLE_V2);
    expect(history.objects[sha(ARTICLE_V1)]).toBe(ARTICLE_V1);
    // Every file ref points at its content's digest.
    for (const file of files) expect(history.objects[file.sha256]).toBeTypeOf('string');
  });
  it('attaches per-revision file lists with matching digests for compatible revisions', () => {
    const history = buildProtocolHistory(fakeGitOps(), { compatibleSince: MIDDLE });
    expect(history.revisions.map((revision) => revision.commit)).toEqual(REV_LIST);
    expect(history.revisions[0].files).toEqual([
      { path: 'protocol/article.shacl.ttl', sha256: sha(ARTICLE_V2) },
      { path: 'protocol/opendraft.ttl', sha256: sha(SHARED) },
    ]);
    expect(history.revisions[1].files).toEqual([
      { path: 'protocol/article.shacl.ttl', sha256: sha(ARTICLE_V1) },
      { path: 'protocol/opendraft.ttl', sha256: sha(SHARED) },
    ]);
  });
});

describe('buildProtocolHistory — compatibleSince gating', () => {
  it('lists revisions older than compatibleSince with compatible false and no files', () => {
    const history = buildProtocolHistory(fakeGitOps(), { compatibleSince: MIDDLE });
    const older = history.revisions.find((revision) => revision.commit === OLDEST);
    expect(older).toEqual({ commit: OLDEST, compatible: false });
    expect(older && 'files' in older).toBe(false);
    expect(history.revisions.filter((revision) => revision.compatible).map((revision) => revision.commit)).toEqual([
      NEWEST,
      MIDDLE,
    ]);
    // Incompatible content is never read.
    const reads: string[] = [];
    buildProtocolHistory(
      fakeGitOps({
        readCommitFile: (commit, path) => {
          reads.push(commit);
          return contentAt(commit, path);
        },
      }),
      { compatibleSince: MIDDLE },
    );
    expect(reads).not.toContain(OLDEST);
  });
  it('marks every revision compatible when compatibleSince is absent or empty', () => {
    for (const options of [{}, { compatibleSince: '' }]) {
      const history = buildProtocolHistory(fakeGitOps(), options);
      expect(history.revisions.every((revision) => revision.compatible)).toBe(true);
      expect(history.revisions.every((revision) => (revision.files ?? []).length > 0)).toBe(true);
      expect(history.compatibleSince).toBe(options.compatibleSince ?? '');
    }
  });
});

describe('buildProtocolHistory — output header', () => {
  it('echoes compatibleSince from the input and takes latest from the newest git rev-list revision', () => {
    const history = buildProtocolHistory(fakeGitOps(), { compatibleSince: MIDDLE });
    expect(history.latest).toBe(NEWEST);
    expect(history.latest).toBe(REV_LIST[0]);
    expect(history.compatibleSince).toBe(MIDDLE);
    const ungated = buildProtocolHistory(fakeGitOps(), {});
    expect(ungated.latest).toBe(NEWEST);
    expect(ungated.compatibleSince).toBe('');
  });
});
