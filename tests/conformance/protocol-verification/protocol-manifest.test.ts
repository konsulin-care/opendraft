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
  normalizeOrigin,
  parseManifest,
  parseProtocolBlock,
  readOriginFromConfig,
  renderProtocolYaml,
  updateManifest,
  type ArtifactRef,
  type GitOps,
  type Manifest,
} from '@protocol-manifest';

const SHA = 'a'.repeat(40);

/** GitOps double whose commit content mirrors the working tree, minus git. */
function fakeGitOps(overrides: Partial<GitOps> = {}): GitOps {
  return {
    lastTtlCommit: () => SHA,
    ttlTreeClean: () => true,
    readCommitFile: (_commit: string, path: string) => Buffer.from(`content of ${path}\n`),
    commitExists: () => true,
    isAncestorOrSelf: () => true,
    ...overrides,
  };
}

/** Creates a fresh temp root with protocol/ and template directories. */
async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'manifest-test-'));
  await mkdir(join(root, 'protocol', 'examples'), { recursive: true });
  await mkdir(join(root, 'templates', 'project'), { recursive: true });
  return root;
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
  return {
    protocol: { name: PROTOCOL_NAME, version: SHA, repository: CANONICAL_REPOSITORY, commit: SHA },
    artifacts,
    generatedBy: 'test',
  };
}

/** Writes the template for a manifest and verifies it in the temp root. */
async function checkWithTemplate(root: string, manifest: Manifest): Promise<string[]> {
  await writeFile(join(root, TEMPLATE_PATH), renderProtocolYaml(manifest.protocol));
  return describeFailures(manifest, fakeGitOps(), { root, canonical: false });
}

/** Asserts committed manifest and template equal the expected manifest. */
async function expectWrittenFiles(root: string, manifest: Manifest): Promise<void> {
  expect(parseManifest(await readFile(join(root, MANIFEST_PATH), 'utf8'))).toEqual(manifest);
  expect(parseProtocolBlock(await readFile(join(root, TEMPLATE_PATH), 'utf8'))).toEqual(manifest.protocol);
}

describe('normalizeOrigin', () => {
  let root: string;
  beforeEach(async () => { root = await makeRoot(); });
  afterEach(async () => { await rm(root, { recursive: true }); });
  it('maps scp-style GitHub remotes to canonical HTTPS', () => {
    expect(normalizeOrigin('git@github.com:konsulin-care/opendraft.git')).toBe(CANONICAL_REPOSITORY);
    expect(normalizeOrigin('https://github.com/konsulin-care/opendraft.git/')).toBe(CANONICAL_REPOSITORY);
  });
  it('normalizes HTTPS remotes and rejects unparseable inputs', () => {
    expect(normalizeOrigin('https://gitlab.com/group/repo')).toBe('https://gitlab.com/group/repo');
    expect(normalizeOrigin(null)).toBeNull();
    expect(normalizeOrigin('')).toBeNull();
    expect(normalizeOrigin('not a url')).toBeNull();
  });
});

describe('hashBytes and hashFile', () => {
  let root: string;
  beforeEach(async () => { root = await makeRoot(); });
  afterEach(async () => { await rm(root, { recursive: true }); });
  it('computes the standard SHA-256 for abc', () => {
    expect(hashBytes(Buffer.from('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
  it('hashes file bytes from disk', async () => {
    await writeFile(join(root, 'protocol/opendraft.ttl'), 'abc');
    const hash = await hashFile(join(root, 'protocol/opendraft.ttl'));
    expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('collectArtifacts', () => {
  let root: string;
  beforeEach(async () => { root = await makeRoot(); });
  afterEach(async () => { await rm(root, { recursive: true }); });
  it('returns sorted protocol-relative .ttl paths only', async () => {
    await writeProtocolFiles(root);
    await writeFile(join(root, 'not-protocol.ttl'), 'outside\n');
    expect(await collectArtifacts(root)).toEqual([
      'protocol/examples/article.ttl',
      'protocol/opendraft.ttl',
    ]);
  });
});

describe('parseManifest and template parsing', () => {
  let root: string;
  beforeEach(async () => { root = await makeRoot(); });
  afterEach(async () => { await rm(root, { recursive: true }); });
  it('round-trips a valid manifest and template document', () => {
    const manifest = {
      protocol: { name: PROTOCOL_NAME, version: SHA, repository: CANONICAL_REPOSITORY, commit: SHA },
      artifacts: [{ path: 'protocol/opendraft.ttl', sha256: 'b'.repeat(64) }],
      generatedBy: 'test',
    };
    expect(parseManifest(JSON.stringify(manifest))).toEqual(manifest);
    const block = { name: PROTOCOL_NAME, version: SHA, repository: CANONICAL_REPOSITORY, commit: SHA };
    expect(parseProtocolBlock(renderProtocolYaml(block))).toEqual(block);
  });
  it('rejects malformed documents', () => {
    expect(() => parseManifest('{}')).toThrow(/protocol block or artifacts list/);
    expect(() => parseManifest(JSON.stringify({ protocol: { name: PROTOCOL_NAME }, artifacts: [] }))).toThrow(/incomplete/);
    expect(() => parseProtocolBlock('protocol:\n  name: opendraft\n')).toThrow(/template is missing protocol\./);
  });
});

describe('readOriginFromConfig', () => {
  let root: string;
  beforeEach(async () => { root = await makeRoot(); });
  afterEach(async () => { await rm(root, { recursive: true }); });
  it('reads the first url under [remote "origin"]', async () => {
    const gitDir = join(root, '.git');
    await mkdir(gitDir, { recursive: true });
    await writeFile(
      join(gitDir, 'config'),
      '[core]\n\trepositoryformatversion = 0\n[remote "origin"]\n\turl = git@github.com:konsulin-care/opendraft.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n',
    );
    expect(readOriginFromConfig(gitDir)).toBe('git@github.com:konsulin-care/opendraft.git');
    expect(readOriginFromConfig(join(root, 'nope'))).toBeNull();
  });
  it('returns null when no origin section exists', async () => {
    const gitDir = join(root, '.git');
    await mkdir(gitDir, { recursive: true });
    await writeFile(join(gitDir, 'config'), '[core]\n\trepositoryformatversion = 0\n');
    expect(readOriginFromConfig(gitDir)).toBeNull();
  });
});

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
    expect(manifest.artifacts.map((a) => a.path)).toEqual([
      'protocol/examples/article.ttl',
      'protocol/opendraft.ttl',
    ]);
    await expectWrittenFiles(root, manifest);
  });
});

describe('updateManifest — origin intent gate', () => {
  let root: string;
  beforeEach(async () => { root = await makeRoot(); });
  afterEach(async () => { await rm(root, { recursive: true }); });
  it('refuses a non-canonical origin without an explicit --repository', async () => {
    await writeProtocolFiles(root);
    await expect(
      updateManifest(fakeGitOps(), { root, canonical: false, originUrl: 'git@github.com:somebody/fork.git' }),
    ).rejects.toThrow(/--repository/);
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
    await expect(
      updateManifest(dirty, { root, canonical: false, originUrl: 'git@github.com:konsulin-care/opendraft.git' }),
    ).rejects.toThrow(/clean/);
  });
  it('enforces the commit-vs-working-tree invariant', async () => {
    await writeProtocolFiles(root);
    const tampering = fakeGitOps({ readCommitFile: () => Buffer.from('evil bytes') });
    await expect(
      updateManifest(tampering, { root, canonical: false, originUrl: 'git@github.com:konsulin-care/opendraft.git' }),
    ).rejects.toThrow(/invariant/);
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

describe('canonical repository integration (committed state)', () => {
  it('verifies the committed manifest against the live working tree', async () => {
    const root = process.cwd();
    const manifest = parseManifest(await readFile(join(root, MANIFEST_PATH), 'utf8'));
    const failures = await describeFailures(manifest, defaultGitOps(root), { root, canonical: false });
    expect(failures).toEqual([]);
  });
});