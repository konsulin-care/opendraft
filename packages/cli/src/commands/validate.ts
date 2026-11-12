import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  collectIncludes,
  validateAssembly,
  validateMetadata,
  validateOpendraft,
  type MetadataType,
} from '@opendraft/schema';
import { checkCitekeys } from '../checks/citekeys.js';

/** Metadata files validated when present in a manuscript directory. */
const METADATA_FILES: readonly MetadataType[] = ['author', 'abstract', 'frontmatter'];

/** File name per metadata type. */
const METADATA_FILE: Record<MetadataType, string> = {
  author: '_author.yml',
  abstract: '_abstract.yml',
  frontmatter: '_frontmatter.yml',
};

/** One finding: the file it concerns, its level, and the message. */
interface Finding {
  level: 'error' | 'warning';
  location: string;
  message: string;
}

/** Manuscript entry of a validated opendraft.yml. */
interface ManuscriptEntry {
  id: string;
  path: string;
}

/**
 * Format a YAML parse failure as a finding message.
 *
 * @param err - Thrown parser error.
 * @returns Human-readable message starting with the failure kind.
 */
function yamlMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return `Failed to parse YAML: ${message}`;
}

/**
 * Read a file as UTF-8 text.
 *
 * @param path - Absolute file path.
 * @returns File contents, or null when the file cannot be read.
 */
function readText(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Validate the project config file.
 *
 * @param root - Project root directory.
 * @param findings - Collector pushed onto.
 * @returns Manuscript entries, or null when the config is unusable.
 */
function readConfig(root: string, findings: Finding[]): ManuscriptEntry[] | null {
  const location = 'opendraft.yml';
  const text = readText(join(root, location));
  if (text === null) {
    findings.push({ level: 'error', location, message: 'File not found.' });
    return null;
  }
  let data: unknown;
  try {
    data = parseYaml(text);
  } catch (err) {
    findings.push({ level: 'error', location, message: yamlMessage(err) });
    return null;
  }
  const result = validateOpendraft(data);
  for (const error of result.errors) {
    findings.push({ level: 'error', location, message: `${error.path}: ${error.message}` });
  }
  if (!result.valid) return null;
  return (data as { manuscripts: ManuscriptEntry[] }).manuscripts;
}

/**
 * Validate a manuscript's metadata files when present.
 *
 * @param root - Project root directory.
 * @param manuscript - Manuscript entry from opendraft.yml.
 * @param findings - Collector pushed onto.
 */
function checkMetadata(root: string, manuscript: ManuscriptEntry, findings: Finding[]): void {
  for (const type of METADATA_FILES) {
    const file = METADATA_FILE[type];
    const location = `${manuscript.path}/${file}`;
    const text = readText(join(root, manuscript.path, file));
    if (text === null) continue;
    let data: unknown;
    try {
      data = parseYaml(text);
    } catch (err) {
      findings.push({ level: 'error', location, message: yamlMessage(err) });
      continue;
    }
    for (const error of validateMetadata(data, type).errors) {
      findings.push({ level: 'error', location, message: `${error.path}: ${error.message}` });
    }
  }
}

/**
 * Extract the section anchor from a block's heading line.
 *
 * @param content - Block file content.
 * @returns Anchor label, or null when the heading carries none.
 */
function headingAnchor(content: string): string | null {
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!/^#\s/.test(trimmed)) continue;
    const match = /\{#([^}\s]+)/.exec(trimmed);
    return match ? match[1] : null;
  }
  return null;
}

/**
 * Map a validator path onto a project-relative file location.
 *
 * @param manuscript - Manuscript entry the finding belongs to.
 * @param path - Validator path (`assembly`, `blocks`, or `blocks/<file>`).
 * @returns Project-relative location string.
 */
function blockLocation(manuscript: ManuscriptEntry, path: string): string {
  return `${manuscript.path}/${path === 'assembly' ? 'article.qmd' : path}`;
}

/**
 * Read the block file contents for assembly validation.
 *
 * @param dir - Absolute manuscript directory.
 * @param files - Basenames inside the blocks directory.
 * @param manuscript - Manuscript entry for finding locations.
 * @param findings - Collector pushed onto.
 * @returns Contents keyed by `blocks/<file>`.
 */
function readBlockFiles(
  dir: string,
  files: string[],
  manuscript: ManuscriptEntry,
  findings: Finding[],
): Record<string, string> {
  const blockFiles: Record<string, string> = {};
  for (const file of files) {
    if (!file.endsWith('.qmd')) continue;
    const text = readText(join(dir, 'blocks', file));
    if (text === null) {
      findings.push({
        level: 'error',
        location: `${manuscript.path}/blocks/${file}`,
        message: 'File not found.',
      });
      continue;
    }
    blockFiles[`blocks/${file}`] = text;
  }
  return blockFiles;
}

/**
 * Report included blocks that share a `sec-` anchor.
 *
 * @param manuscript - Manuscript entry for finding locations.
 * @param assembly - Container article text.
 * @param blockFiles - Block contents keyed by `blocks/<file>`.
 * @param findings - Collector pushed onto.
 */
function checkAnchors(
  manuscript: ManuscriptEntry,
  assembly: string,
  blockFiles: Record<string, string>,
  findings: Finding[],
): void {
  const seen = new Map<string, string>();
  for (const path of collectIncludes(assembly)) {
    const content = blockFiles[path];
    if (content === undefined) continue;
    const anchor = headingAnchor(content);
    if (anchor === null) continue;
    const previous = seen.get(anchor);
    if (previous !== undefined) {
      findings.push({
        level: 'error',
        location: `${manuscript.path}/article.qmd`,
        message: `duplicate anchor ${anchor}: ${previous} and ${path}`,
      });
      continue;
    }
    seen.set(anchor, path);
  }
}

/**
 * Validate a manuscript's assembly: article includes, block files, anchor
 * contract and block citekeys; unreferenced files surface as warnings.
 *
 * @param root - Project root directory.
 * @param manuscript - Manuscript entry from opendraft.yml.
 * @param findings - Collector pushed onto.
 */
function checkAssembly(root: string, manuscript: ManuscriptEntry, findings: Finding[]): void {
  const dir = join(root, manuscript.path);
  const assembly = readText(join(dir, 'article.qmd'));
  if (assembly === null) {
    findings.push({
      level: 'error',
      location: `${manuscript.path}/article.qmd`,
      message: 'File not found.',
    });
    return;
  }
  let files: string[];
  try {
    files = readdirSync(join(dir, 'blocks'));
  } catch {
    files = [];
  }
  const blockFiles = readBlockFiles(dir, files, manuscript, findings);
  const result = validateAssembly({ assembly, blockFiles, files });
  for (const error of result.errors) {
    findings.push({
      level: 'error',
      location: blockLocation(manuscript, error.path),
      message: error.message,
    });
  }
  for (const warning of result.warnings) {
    findings.push({
      level: 'warning',
      location: blockLocation(manuscript, warning.path),
      message: warning.message,
    });
  }
  checkAnchors(manuscript, assembly, blockFiles, findings);
  findings.push(...checkCitekeys(root, manuscript.path, assembly, blockFiles));
}

/**
 * Print collected findings: errors to stderr, warnings to stderr, and a
 * success line when no errors were found.
 *
 * @param findings - All findings from the run, in discovery order.
 */
function report(findings: Finding[]): void {
  const errors = findings.filter((finding) => finding.level === 'error');
  for (const finding of findings) {
    if (finding.level === 'warning') {
      console.warn(`warning: ${finding.location}: ${finding.message}`);
    }
  }
  if (errors.length === 0) {
    console.log('✓ Project validation passed.');
    return;
  }
  console.error('✗ Project validation failed:');
  for (const error of errors) {
    console.error(`  ${error.location}: ${error.message}`);
  }
}

/**
 * Run the `validate` command: config, metadata and assembly checks.
 *
 * Reads `opendraft.yml` from the project root, validates each listed
 * manuscript's metadata files and assembly, and prints the result.
 * Warnings (e.g. orphan draft blocks) never fail the run.
 *
 * @param args - Arguments after the command name; optional project root
 *               (defaults to the current working directory).
 * @returns Exit code: 0 when no errors (warnings allowed), 1 otherwise.
 */
export function validateCommand(args: string[]): number {
  const root = args[0] ?? process.cwd();
  const findings: Finding[] = [];
  const manuscripts = readConfig(root, findings);
  if (manuscripts !== null) {
    for (const manuscript of manuscripts) {
      checkMetadata(root, manuscript, findings);
      checkAssembly(root, manuscript, findings);
    }
  }
  report(findings);
  return findings.some((finding) => finding.level === 'error') ? 1 : 0;
}
