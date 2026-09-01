#!/usr/bin/env node
/**
 * protocol-manifest.ts — generate and verify the protocol verification manifest.
 *   --update               regenerate protocol/protocol.manifest.json and templates/project/opendraft.yml
 *   --check                verify committed artifacts against the manifest
 *   --repository <url>     (with --update) explicit-intent repository override (fork PRs)
 * Spec: protocol/versioning.md. The revision commit is the last commit touching
 * a TTL artifact below protocol/, never the repository tip.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const CANONICAL_REPOSITORY = 'https://github.com/konsulin-care/opendraft';
export const PROTOCOL_NAME = 'opendraft';
export const MANIFEST_PATH = 'protocol/protocol.manifest.json';
export const TEMPLATE_PATH = 'templates/project/opendraft.yml';
export const GENERATED_BY = 'mise run update-protocol-manifest';
export const TTL_GLOB_PATHSPEC = ':(glob)protocol/**/*.ttl';

const SHA40 = /^[0-9a-f]{40}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
/** Protocol revision model: name, version, repository, commit (protocol/versioning.md). */
export interface ProtocolBlock {
  name: string;
  version: string;
  repository: string;
  commit: string;
}
/** One pinned protocol artifact and its expected SHA-256 digest. */
export interface ArtifactRef {
  path: string;
  sha256: string;
}
/** The committed verification manifest. */
export interface Manifest {
  protocol: ProtocolBlock;
  artifacts: ArtifactRef[];
  generatedBy: string;
}
/** Git operations shared by manifest generation and verification. */
export interface GitOps {
  lastTtlCommit(): string;
  ttlTreeClean(): boolean;
  readCommitFile(commit: string, path: string): Buffer;
  commitExists(commit: string): boolean;
  isAncestorOrSelf(commit: string): boolean;
}
/** Options accepted by both update and check flows. */
export interface ManifestOptions {
  root: string;
  canonical: boolean;
  originUrl?: string | null;
  declaredRepository?: string;
}

/** SHA-256 hex digest of a byte buffer. */
export function hashBytes(data: Buffer): string { return createHash('sha256').update(data).digest('hex'); }
/** SHA-256 hex digest of the file at an absolute path. */
export async function hashFile(absPath: string): Promise<string> {
  return hashBytes(await readFile(absPath));
}
/** Sorted protocol-relative paths of every .ttl artifact below <root>/protocol. */
export async function collectArtifacts(root: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true });
  return entries
    .filter((entry) => entry.startsWith('protocol/') && entry.endsWith('.ttl'))
    .map((entry) => entry.split(sep).join('/'))
    .sort();
}
/** Normalizes a Git remote URL to its HTTPS form, or null when unrecognized. */
export function normalizeOrigin(url: string | null): string | null {
  if (!url) return null;
  const cleaned = url.trim().replace(/\/+$/, '').replace(/\.git$/, '');
  const scp = cleaned.match(/^git@([^:]+):(.+)$/);
  if (scp) return `https://${scp[1]}/${scp[2].replace(/^\/+/, '')}`;
  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return `https://${parsed.host}${parsed.pathname}`;
  } catch {
    return null;
  }
}
/** Reads the origin remote URL from <gitDir>/config, or null when absent. */
export function readOriginFromConfig(gitDir: string): string | null {
  try {
    const lines = readFileSync(join(gitDir, 'config'), 'utf8').split('\n');
    let insideOrigin = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('[')) {
        insideOrigin = /^\[remote\s+"origin"\]$/.test(trimmed);
        continue;
      }
      if (insideOrigin && /^url\s*=/.test(trimmed)) {
        return trimmed.replace(/^url\s*=\s*/, '');
      }
    }
    return null;
  } catch {
    return null;
  }
}
/** Parses the fixed-format protocol block out of the generated template YAML. */
export function parseProtocolBlock(yamlText: string): ProtocolBlock {
  const entries: string[] = [];
  let inside = false;
  for (const line of yamlText.split('\n')) {
    if (line === 'protocol:') {
      inside = true;
      continue;
    }
    if (inside) {
      if (line.startsWith('  ') && line.includes(':')) entries.push(line.trim());
      else inside = false;
    }
  }
  const block: Record<string, string> = {};
  for (const entry of entries) {
    const idx = entry.indexOf(':');
    block[entry.slice(0, idx).trim()] = entry.slice(idx + 1).trim();
  }
  for (const key of ['name', 'version', 'repository', 'commit'] as const) {
    if (!block[key]) throw new Error(`template is missing protocol.${key}`);
  }
  return { name: block.name, version: block.version, repository: block.repository, commit: block.commit };
}
/** Renders the generated project template YAML for a protocol block. */
export function renderProtocolYaml(block: ProtocolBlock): string {
  return [
    'protocol:', `  name: ${block.name}`, `  version: ${block.version}`,
    `  repository: ${block.repository}`, `  commit: ${block.commit}`, 'manuscripts: []', '',
  ].join('\n');
}
/** Parses and structurally validates a manifest document. */
export function parseManifest(text: string): Manifest {
  const raw = JSON.parse(text) as Partial<Manifest>;
  if (!raw.protocol || !Array.isArray(raw.artifacts)) {
    throw new Error('manifest is missing the protocol block or artifacts list');
  }
  if (raw.artifacts.some((a) => typeof a?.path !== 'string' || typeof a?.sha256 !== 'string')) {
    throw new Error('manifest contains an artifact without path or sha256');
  }
  const p = raw.protocol as Partial<ProtocolBlock>;
  if (!p.name || !p.version || !p.repository || !p.commit) throw new Error('manifest protocol block is incomplete');
  return {
    protocol: { name: p.name, version: p.version, repository: p.repository, commit: p.commit },
    artifacts: raw.artifacts as ArtifactRef[],
    generatedBy: raw.generatedBy ?? '',
  };
}
/** Structural equality of two protocol blocks. */
export function blocksEqual(a: ProtocolBlock, b: ProtocolBlock): boolean { return a.name === b.name && a.version === b.version && a.repository === b.repository && a.commit === b.commit; }
/** Reads and parses the committed template protocol block, or null. */
export async function readTemplateBlock(root: string): Promise<ProtocolBlock | null> {
  try {
    return parseProtocolBlock(await readFile(join(root, TEMPLATE_PATH), 'utf8'));
  } catch {
    return null;
  }
}
/** Returns identity and schema failures for the manifest protocol block. */
function schemaFailures(m: Manifest): string[] {
  const p = m.protocol;
  const failures: string[] = [];
  if (p.name !== PROTOCOL_NAME) failures.push(`protocol.name is '${p.name}', expected '${PROTOCOL_NAME}'`);
  if (!SHA40.test(p.version)) failures.push(`protocol.version '${p.version}' is not a full SHA`);
  if (!SHA40.test(p.commit)) failures.push(`protocol.commit '${p.commit}' is not a full SHA`);
  if (p.version !== p.commit) failures.push('protocol.version must equal protocol.commit');
  if (m.artifacts.length === 0) failures.push('manifest lists no artifacts');
  for (const a of m.artifacts) {
    if (!SHA256_HEX.test(a.sha256)) failures.push(`artifact ${a.path}: sha256 is not hex`);
  }
  return failures;
}
/** Returns local-content failures: artifact set drift, missing or changed files. */
async function artifactFailures(m: Manifest, root: string): Promise<string[]> {
  const actual = await collectArtifacts(root);
  const declared = m.artifacts.map((a) => a.path).sort();
  const failures: string[] = [];
  if (declared.join('\n') !== actual.join('\n')) {
    failures.push(`artifact set mismatch (manifest: ${declared.length}, actual: ${actual.length})`);
  }
  for (const a of m.artifacts) {
    const fileHash = await hashFile(join(root, a.path)).catch(() => null);
    if (fileHash === null) failures.push(`artifact ${a.path} is missing on disk`);
    else if (fileHash !== a.sha256) {
      failures.push(`artifact ${a.path} content changed (declared ${a.sha256.slice(0, 8)}, found ${fileHash.slice(0, 8)})`);
    }
  }
  return failures;
}
/** Returns template drift failures against the manifest protocol block. */
async function templateFailures(m: Manifest, root: string): Promise<string[]> {
  const template = await readTemplateBlock(root);
  if (template === null) return [`template ${TEMPLATE_PATH} is missing`];
  if (!blocksEqual(template, m.protocol)) return ['template protocol block drifted from manifest'];
  return [];
}
/** Returns human-readable failures for a manifest; an empty array means it verifies. */
export async function describeFailures(manifest: Manifest, gitOps: GitOps, options: ManifestOptions): Promise<string[]> {
  return [
    ...schemaFailures(manifest),
    ...(await artifactFailures(manifest, options.root)),
    ...(await templateFailures(manifest, options.root)),
  ];
}
/** Resolves the repository URL, enforcing the canonical-origin intent gate. */
function resolveRepository(options: ManifestOptions): string {
  if (options.declaredRepository) {
    const normalized = normalizeOrigin(options.declaredRepository);
    if (!normalized) throw new Error(`--repository '${options.declaredRepository}' is not a usable HTTPS URL`);
    return normalized;
  }
  if (normalizeOrigin(options.originUrl ?? null) === CANONICAL_REPOSITORY) return CANONICAL_REPOSITORY;
  throw new Error(
    `origin '${options.originUrl ?? '<none>'}' is not the canonical repository (${CANONICAL_REPOSITORY}); ` +
      'pass --repository <url> to override for an upstream-targeted PR',
  );
}
/** Regenerates the manifest and project template for the current revision. */
export async function updateManifest(gitOps: GitOps, options: ManifestOptions): Promise<Manifest> {
  if (!gitOps.ttlTreeClean()) throw new Error('protocol TTL working tree is not clean; commit or revert protocol TTL files first');
  const commit = gitOps.lastTtlCommit();
  if (!SHA40.test(commit)) throw new Error(`resolved commit '${commit}' is not a full SHA`);
  const artifacts: ArtifactRef[] = [];
  for (const relPath of await collectArtifacts(options.root)) {
    const fileHash = await hashFile(join(options.root, relPath));
    const gitHash = hashBytes(gitOps.readCommitFile(commit, relPath));
    if (gitHash !== fileHash) throw new Error(`invariant violation: ${relPath} at ${commit} does not match the working tree`);
    artifacts.push({ path: relPath, sha256: fileHash });
  }
  if (artifacts.length === 0) throw new Error('no protocol artifacts found under protocol/');
  const protocol = { name: PROTOCOL_NAME, version: commit, repository: resolveRepository(options), commit };
  const manifest: Manifest = { protocol, artifacts, generatedBy: GENERATED_BY };
  await writeFile(join(options.root, MANIFEST_PATH), `${JSON.stringify(manifest, null, 2)}\n`);
  await mkdir(join(options.root, dirname(TEMPLATE_PATH)), { recursive: true });
  await writeFile(join(options.root, TEMPLATE_PATH), renderProtocolYaml(manifest.protocol));
  return manifest;
}
/** Git operations backed by the repository at the given working directory. */
export function defaultGitOps(dir: string): GitOps {
  const run = (args: string[], quiet = false): Buffer => execFileSync('git', args, { cwd: dir, stdio: quiet ? 'ignore' : 'pipe' });
  const silent = (args: string[]): boolean => {
    try {
      run(args, true);
      return true;
    } catch {
      return false;
    }
  };
  return {
    lastTtlCommit: () => run(['rev-list', '-1', 'HEAD', '--', TTL_GLOB_PATHSPEC]).toString('utf8').trim(),
    ttlTreeClean: () => run(['status', '--porcelain', '--', TTL_GLOB_PATHSPEC]).toString('utf8').trim() === '',
    readCommitFile: (commit, path) => run(['show', `${commit}:${path}`]),
    commitExists: (commit) => silent(['cat-file', '-e', `${commit}^{commit}`]),
    isAncestorOrSelf: (commit) => silent(['merge-base', '--is-ancestor', commit, 'HEAD']),
  };
}
/** Resolves --git-dir for the working directory, for reading origin config. */
export function resolveGitDir(dir: string): string { return execFileSync('git', ['rev-parse', '--git-dir'], { cwd: dir }).toString('utf8').trim(); }
/** CLI entry point. */
export async function main(args: string[]): Promise<void> {
  const mode = args.includes('--update') ? 'update' : args.includes('--check') ? 'check' : null;
  if (mode === null || args.includes('--help')) {
    process.stderr.write('usage: protocol-manifest.ts --update | --check [--canonical] [--repository <url>]\n');
    process.exitCode = mode === null ? 1 : 0;
    return;
  }
  const repoFlag = args.indexOf('--repository');
  const options: ManifestOptions = {
    root: process.cwd(),
    canonical: args.includes('--canonical'),
    declaredRepository: repoFlag >= 0 ? args[repoFlag + 1] : undefined,
    originUrl: null,
  };
  const gitOps = defaultGitOps(options.root);
  if (mode === 'update') {
    options.originUrl = readOriginFromConfig(join(options.root, resolveGitDir(options.root)));
    const manifest = await updateManifest(gitOps, options);
    process.stdout.write(`pinned revision ${manifest.protocol.commit} in ${MANIFEST_PATH} and ${TEMPLATE_PATH}\n`);
    return;
  }
  const manifest = parseManifest(await readFile(join(options.root, MANIFEST_PATH), 'utf8'));
  const failures = await describeFailures(manifest, gitOps, options);
  if (failures.length > 0) {
    for (const failure of failures) process.stderr.write(`FAIL: ${failure}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`ok: protocol verifies against ${manifest.protocol.commit}\n`);
}
const invokedDirectly = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) await main(process.argv.slice(2));