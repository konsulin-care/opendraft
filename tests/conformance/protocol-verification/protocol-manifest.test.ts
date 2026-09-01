import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CANONICAL_REPOSITORY,
  PROTOCOL_NAME,
  collectArtifacts,
  hashBytes,
  hashFile,
  normalizeOrigin,
  parseManifest,
  parseProtocolBlock,
  readOriginFromConfig,
  renderProtocolYaml,
} from '@protocol-manifest';

const SHA = 'a'.repeat(40);

describe('normalizeOrigin', () => {
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
  let tmp: string;
  beforeEach(async () => { tmp = await mkdtemp(join(tmpdir(), 'manifest-test-')); });
  afterEach(async () => { await rm(tmp, { recursive: true }); });
  it('computes the standard SHA-256 for abc', () => {
    expect(hashBytes(Buffer.from('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
  it('hashes file bytes from disk', async () => {
    const file = join(tmp, 'abc.txt');
    writeFileSync(file, 'abc');
    expect(await hashFile(file)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('collectArtifacts', () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'manifest-test-'));
    await mkdir(join(tmp, 'protocol', 'examples'), { recursive: true });
    await mkdir(join(tmp, 'protocol', 'sub'), { recursive: true });
  });
  afterEach(async () => { await rm(tmp, { recursive: true }); });
  it('returns sorted protocol-relative .ttl paths only', async () => {
    for (const rel of ['protocol/opendraft.ttl', 'protocol/examples/article.ttl', 'protocol/sub/extra.ttl']) {
      await writeFile(join(tmp, rel), `content of ${rel}\n`);
    }
    await writeFile(join(tmp, 'protocol/README.md'), '# docs only\n');
    await writeFile(join(tmp, 'not-protocol.ttl'), 'outside\n');
    expect(await collectArtifacts(tmp)).toEqual([
      'protocol/examples/article.ttl',
      'protocol/opendraft.ttl',
      'protocol/sub/extra.ttl',
    ]);
  });
});

describe('parseManifest and template parsing', () => {
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
  let tmp: string;
  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'manifest-test-'));
    await mkdir(join(tmp, '.git'), { recursive: true });
  });
  afterEach(async () => { await rm(tmp, { recursive: true }); });
  it('reads the first url under [remote "origin"]', () => {
    writeFileSync(
      join(tmp, '.git/config'),
      '[core]\n\trepositoryformatversion = 0\n[remote "origin"]\n\turl = git@github.com:konsulin-care/opendraft.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n',
    );
    expect(readOriginFromConfig(join(tmp, '.git'))).toBe('git@github.com:konsulin-care/opendraft.git');
  });
  it('returns null when no origin section exists or config is missing', () => {
    writeFileSync(join(tmp, '.git/config'), '[core]\n\trepositoryformatversion = 0\n');
    expect(readOriginFromConfig(join(tmp, '.git'))).toBeNull();
    expect(readOriginFromConfig(join(tmp, 'nope'))).toBeNull();
  });
});