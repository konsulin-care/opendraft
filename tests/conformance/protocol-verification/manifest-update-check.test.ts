import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CANONICAL_REPOSITORY,
  MANIFEST_PATH,
  PROTOCOL_NAME,
  TEMPLATE_PATH,
  collectArtifacts,
  defaultGitOps,
  describeFailures,
  hashBytes,
  hashFile,
  parseManifest,
  parseProtocolBlock,
  renderProtocolYaml,
  updateManifest,
  type ArtifactRef,
  type Manifest,
} from '@protocol-manifest';
import { type HistoryGitOps, type ProtocolHistory } from '../../../scripts/protocol-history';

const SHA = 'a'.repeat(40);
/** Fake rev-list of TTL-touching commits, newest first. */
const HISTORY_COMMITS = [SHA, 'b'.repeat(40), 'c'.repeat(40)];
/** Fake protocol .ttl paths present at every revision. */
const HISTORY_FILES = ['protocol/examples/article.ttl', 'protocol/opendraft.ttl'];
/** Bundled-history path below the root, per the T62 contract. */
const HISTORY_REL = 'packages/rdf/src/protocol-history.generated.json';

/** GitOps double whose commit content mirrors the working tree, minus git. */
function fakeGitOps(overrides: Partial<HistoryGitOps> = {}): HistoryGitOps {
  return {
    lastTtlCommit: () => SHA,
    ttlTreeClean: () => true,
    readCommitFile: (_commit: string, path: string) => Buffer.from(`content of ${path}\n`),
    commitExists: () => true,
    isAncestorOrSelf: () => true,
    ttlCommits: () => [...HISTORY_COMMITS],
    ttlPathsAt: () => [...HISTORY_FILES],
    ...overrides,
  };
}

/** Fresh temp root with protocol/ and template directories. */
async function makeRoot(): Promise<string> {
  const tmp = await mkdtemp(join(tmpdir(), 'manifest-test-'));
  for (const dir of ['protocol/examples', 'templates/project']) await mkdir(join(tmp, dir), { recursive: true });
  return tmp;
}

/** Writes two .ttl artifacts plus one non-artifact .md file. */
async function writeProtocolFiles(root: string): Promise<void> {
  for (const rel of ['protocol/opendraft.ttl', 'protocol/examples/article.ttl']) {
    await writeFile(join(root, rel), `content of ${rel}\n`);
  }
  await writeFile(join(root, 'protocol/README.md'), '# docs only\n');
}

/** Manifest whose declared hashes match the temp working tree. */
async function makeManifest(root: string): Promise<Manifest> {
  const artifacts: ArtifactRef[] = [];
  for (const rel of await collectArtifacts(root)) {
    artifacts.push({ path: rel, sha256: await hashFile(join(root, rel)) });
  }
  return { protocol: { name: PROTOCOL_NAME, version: SHA, repository: CANONICAL_REPOSITORY, commit: SHA }, artifacts, generatedBy: 'test' };
}

/** Writes the template for a manifest and verifies it in the temp root. */
async function checkWithTemplate(root: string, manifest: Manifest): Promise<string[]> {
  await writeFile(join(root, TEMPLATE_PATH), renderProtocolYaml(manifest.protocol));
  return describeFailures(manifest, fakeGitOps(), { root, canonical: false });
}

describe('updateManifest — revision pinning', () => {
  let root: string;
  beforeEach(async () => { root = await makeRoot(); });
  afterEach(async () => { await rm(root, { recursive: true }); });
  it('writes manifest and template with matching revision data', async () => {
    await writeProtocolFiles(root);
    const manifest = await updateManifest(fakeGitOps(), {
      root,
      canonical: false,
      originUrl: 'git@github.com:konsulin-care/opendraft.git',
    });
    expect(manifest.protocol).toEqual({
      name: PROTOCOL_NAME,
      version: SHA,
      repository: CANONICAL_REPOSITORY,
      commit: SHA,
    });
    expect(manifest.artifacts.map((a) => a.path)).toEqual(['protocol/examples/article.ttl', 'protocol/opendraft.ttl']);
    expect(parseManifest(await readFile(join(root, MANIFEST_PATH), 'utf8'))).toEqual(manifest);
    expect(parseProtocolBlock(await readFile(join(root, TEMPLATE_PATH), 'utf8'))).toEqual(manifest.protocol);
  });
  it('preserves a hand-set compatibleSince while refreshing commit and artifacts', async () => {
    await writeProtocolFiles(root);
    const existing = await makeManifest(root);
    existing.protocol.compatibleSince = 'c'.repeat(40);
    existing.artifacts = [{ path: 'protocol/opendraft.ttl', sha256: 'e'.repeat(64) }];
    await writeFile(join(root, MANIFEST_PATH), `${JSON.stringify(existing, null, 2)}\n`);
    const refreshed = 'd'.repeat(40);
    const manifest = await updateManifest(fakeGitOps({ lastTtlCommit: () => refreshed }), {
      root,
      canonical: false,
      originUrl: 'git@github.com:konsulin-care/opendraft.git',
    });
    expect(manifest.protocol.compatibleSince).toBe('c'.repeat(40));
    expect(manifest.protocol.commit).toBe(refreshed);
    expect(manifest.protocol.version).toBe(refreshed);
    expect(manifest.artifacts).toEqual([{ path: 'protocol/examples/article.ttl', sha256: await hashFile(join(root, 'protocol/examples/article.ttl')) }, { path: 'protocol/opendraft.ttl', sha256: await hashFile(join(root, 'protocol/opendraft.ttl')) }]);
    const written = parseManifest(await readFile(join(root, MANIFEST_PATH), 'utf8'));
    expect(written.protocol.compatibleSince).toBe('c'.repeat(40));
    expect(written.protocol.commit).toBe(refreshed);
    const template = parseProtocolBlock(await readFile(join(root, TEMPLATE_PATH), 'utf8'));
    expect(template.commit).toBe(refreshed);
    expect(template.compatibleSince).toBeUndefined();
  });
});

describe('updateManifest — origin intent gate', () => {
  let root: string;
  beforeEach(async () => { root = await makeRoot(); });
  afterEach(async () => { await rm(root, { recursive: true }); });
  it('refuses a non-canonical origin without an explicit --repository', async () => {
    await writeProtocolFiles(root);
    await expect(updateManifest(fakeGitOps(), { root, canonical: false, originUrl: 'git@github.com:somebody/fork.git' })).rejects.toThrow(/--repository/);
  });
  it('accepts a fork origin when --repository is declared', async () => {
    await writeProtocolFiles(root);
    const manifest = await updateManifest(fakeGitOps(), {
      root,
      canonical: false,
      originUrl: 'git@github.com:somebody/fork.git',
      declaredRepository: CANONICAL_REPOSITORY,
    });
    expect(manifest.protocol.repository).toBe(CANONICAL_REPOSITORY);
  });
});

describe('updateManifest — safety guards', () => {
  let root: string;
  beforeEach(async () => { root = await makeRoot(); });
  afterEach(async () => { await rm(root, { recursive: true }); });
  it('rejects a dirty protocol TTL tree', async () => {
    await writeProtocolFiles(root);
    const dirty = fakeGitOps({ ttlTreeClean: () => false });
    await expect(updateManifest(dirty, { root, canonical: false, originUrl: 'git@github.com:konsulin-care/opendraft.git' })).rejects.toThrow(/clean/);
  });
  it('enforces the commit-vs-working-tree invariant', async () => {
    await writeProtocolFiles(root);
    const tampering = fakeGitOps({ readCommitFile: () => Buffer.from('evil bytes') });
    await expect(updateManifest(tampering, { root, canonical: false, originUrl: 'git@github.com:konsulin-care/opendraft.git' })).rejects.toThrow(/invariant/);
  });
});

describe('describeFailures — local drift detection', () => {
  let root: string;
  beforeEach(async () => { root = await makeRoot(); });
  afterEach(async () => { await rm(root, { recursive: true }); });
  it('returns no failures when manifest, tree, and template agree', async () => {
    await writeProtocolFiles(root);
    const manifest = await makeManifest(root);
    expect(await checkWithTemplate(root, manifest)).toEqual([]);
  });
  it('flags a tampered artifact file', async () => {
    await writeProtocolFiles(root);
    const manifest = await makeManifest(root);
    await writeFile(join(root, 'protocol/opendraft.ttl'), 'tampered\n');
    expect((await checkWithTemplate(root, manifest)).join('\n')).toMatch(/content changed/);
  });
  it('flags a missing artifact file', async () => {
    await writeProtocolFiles(root);
    const manifest = await makeManifest(root);
    await rm(join(root, 'protocol/opendraft.ttl'));
    expect((await checkWithTemplate(root, manifest)).join('\n')).toMatch(/missing/);
  });
  it('flags artifact set drift (unlisted ttl file)', async () => {
    await writeProtocolFiles(root);
    const manifest = await makeManifest(root);
    await writeFile(join(root, 'protocol/extra.ttl'), 'extra\n');
    expect((await checkWithTemplate(root, manifest)).join('\n')).toMatch(/artifact set mismatch/);
  });
});

describe('describeFailures — manifest identity', () => {
  let root: string;
  beforeEach(async () => { root = await makeRoot(); });
  afterEach(async () => { await rm(root, { recursive: true }); });
  it('flags a template that drifted from the manifest', async () => {
    await writeProtocolFiles(root);
    const manifest = await makeManifest(root);
    await writeFile(join(root, TEMPLATE_PATH), renderProtocolYaml({ ...manifest.protocol, commit: 'b'.repeat(40) }));
    const failures = await describeFailures(manifest, fakeGitOps(), { root, canonical: false });
    expect(failures.join('\n')).toMatch(/template protocol block drifted/);
  });
  it('flags a short (non-full) commit SHA', async () => {
    await writeProtocolFiles(root);
    const manifest = await makeManifest(root);
    const short = { ...manifest, protocol: { ...manifest.protocol, commit: 'abc123' } };
    expect((await checkWithTemplate(root, short)).join('\n')).toMatch(/not a full SHA/);
  });
});

describe('describeFailures — commit consistency', () => {
  let root: string;
  beforeEach(async () => { root = await makeRoot(); });
  afterEach(async () => { await rm(root, { recursive: true }); });
  it('flags an artifact whose declared commit content differs', async () => {
    await writeProtocolFiles(root);
    const manifest = await makeManifest(root);
    const tampering = fakeGitOps({ readCommitFile: () => Buffer.from('evil bytes') });
    const failures = await describeFailures(manifest, tampering, { root, canonical: false });
    expect(failures.join('\n')).toMatch(/at commit .* does not match declared sha256/);
  });
  it('flags an unresolvable declared commit', async () => {
    await writeProtocolFiles(root);
    const manifest = await makeManifest(root);
    const missing = fakeGitOps({ commitExists: () => false });
    const failures = await describeFailures(manifest, missing, { root, canonical: false });
    expect(failures.join('\n')).toMatch(/commit .* is not resolvable/);
  });
  it('flags a declared commit that is not ancestor-or-self of HEAD', async () => {
    await writeProtocolFiles(root);
    const manifest = await makeManifest(root);
    const detached = fakeGitOps({ isAncestorOrSelf: () => false });
    const failures = await describeFailures(manifest, detached, { root, canonical: false });
    expect(failures.join('\n')).toMatch(/not an ancestor-or-self of HEAD/);
  });
  it('flags a non-canonical repository under --canonical', async () => {
    await writeProtocolFiles(root);
    const manifest = await makeManifest(root);
    manifest.protocol.repository = 'https://github.com/somebody/fork';
    await writeFile(join(root, TEMPLATE_PATH), renderProtocolYaml(manifest.protocol));
    const failures = await describeFailures(manifest, fakeGitOps(), { root, canonical: true });
    expect(failures.join('\n')).toMatch(/not canonical/);
  });
});

describe('canonical repository integration (committed state)', () => {
  it('verifies the committed manifest against the live working tree', async () => {
    const root = process.cwd();
    const manifest = parseManifest(await readFile(join(root, MANIFEST_PATH), 'utf8'));
    const failures = await describeFailures(manifest, defaultGitOps(root), { root, canonical: false });
    expect(failures).toEqual([]);
  });
});

describe('project template pinning (committed state)', () => {
  it('pins the manifest revision in templates/project/opendraft.yml', async () => {
    const root = process.cwd();
    const manifest = parseManifest(await readFile(join(root, MANIFEST_PATH), 'utf8'));
    const template = parseProtocolBlock(await readFile(join(root, TEMPLATE_PATH), 'utf8'));
    expect(template).toEqual(manifest.protocol);
    expect(template.version).toBe(template.commit);
    expect(template.version).toMatch(/^[0-9a-f]{40}$/);
    expect(template.name).toBe(PROTOCOL_NAME);
    expect(template.repository).toBe(CANONICAL_REPOSITORY);
  });
});

describe('updateManifest — bundled history write', () => {
  let root: string;
  beforeEach(async () => { root = await makeRoot(); });
  afterEach(async () => { await rm(root, { recursive: true }); });
  const run = (): Promise<Manifest> =>
    updateManifest(fakeGitOps(), { root, canonical: false, originUrl: 'git@github.com:konsulin-care/opendraft.git' });
  it('writes the history file with latest, compatibleSince, revisions and objects keyed by sha256', async () => {
    await writeProtocolFiles(root);
    const existing = await makeManifest(root);
    existing.protocol.compatibleSince = 'c'.repeat(40);
    await writeFile(join(root, MANIFEST_PATH), `${JSON.stringify(existing, null, 2)}\n`);
    await run();
    const history = JSON.parse(await readFile(join(root, HISTORY_REL), 'utf8')) as ProtocolHistory;
    expect(history.latest).toBe(SHA);
    expect(history.compatibleSince).toBe('c'.repeat(40));
    expect(history.revisions.map((revision) => revision.commit)).toEqual(HISTORY_COMMITS);
    const digests = HISTORY_FILES.map((path) => hashBytes(Buffer.from(`content of ${path}\n`))).sort();
    expect(Object.keys(history.objects).sort()).toEqual(digests);
    for (const revision of history.revisions) {
      for (const file of revision.files ?? []) expect(history.objects[file.sha256]).toBeTypeOf('string');
    }
  });
  it('re-running updateManifest with unchanged protocol files produces byte-identical history output', async () => {
    await writeProtocolFiles(root);
    await run();
    const first = await readFile(join(root, HISTORY_REL));
    await run();
    expect((await readFile(join(root, HISTORY_REL))).equals(first)).toBe(true);
  });
  it('with no compatibleSince in the manifest, the generated history marks every revision compatible', async () => {
    await writeProtocolFiles(root);
    expect((await run()).protocol.compatibleSince).toBeUndefined();
    const history = JSON.parse(await readFile(join(root, HISTORY_REL), 'utf8')) as ProtocolHistory;
    expect(history.compatibleSince).toBe('');
    expect(history.revisions.length).toBeGreaterThan(0);
    expect(history.revisions.every((revision) => revision.compatible)).toBe(true);
  });
});