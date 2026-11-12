import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addBlock, scaffoldProject } from '@opendraft/manuscript';
import type { ProtocolBlock } from '@opendraft/manuscript';
import { NodeFsWorkspace } from '@opendraft/workspace/node';
import { runCli } from '../src/index.js';

/** Protocol block accepted by the opendraft.yml schema. */
const PROTOCOL: ProtocolBlock = {
  name: 'opendraft',
  version: 'e849ba8a46528d523d5f3d18f5f0171853f13030',
  repository: 'https://github.com/konsulin-care/opendraft',
  commit: 'e849ba8a46528d523d5f3d18f5f0171853f13030',
};

/** Manuscript directory written by the scaffold for id `demo`. */
const MANUSCRIPT_DIR = 'manuscripts/demo';

/** Shared bibliography scaffolded at the project root. */
const BIB_FILE = 'manuscripts/references.bib';

/** Citekey defined by the scaffolded shared bibliography. */
const KNOWN_KEY = 'doe2024';

/** Citekey absent from every bibliography in these tests. */
const UNKNOWN_KEY = 'nobody1999';

/** Result of one captured CLI run. */
interface CliRun {
  /** Exit code returned by runCli. */
  code: number;
  /** Everything printed to stdout and stderr. */
  output: string;
}

let dir: string;

/**
 * Run `validate <dir>` with console output captured.
 *
 * @param projectDir - Project root passed to the CLI.
 * @returns Exit code plus the combined printed output.
 */
function runValidate(projectDir: string): CliRun {
  const lines: string[] = [];
  const capture = (...data: unknown[]): void => {
    lines.push(data.map(String).join(' '));
  };
  const spies = [
    vi.spyOn(console, 'log').mockImplementation(capture),
    vi.spyOn(console, 'error').mockImplementation(capture),
    vi.spyOn(console, 'warn').mockImplementation(capture),
  ];
  try {
    return { code: runCli(['validate', projectDir]), output: lines.join('\n') };
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
}

/**
 * Scaffold a project rooted at the current temp directory.
 *
 * @returns Workspace adapter rooted at the temp directory.
 */
async function scaffoldedProject(): Promise<NodeFsWorkspace> {
  const ws = new NodeFsWorkspace(dir);
  await scaffoldProject(ws, { manuscriptId: 'demo', protocol: PROTOCOL });
  return ws;
}

/**
 * Create the `Introduction` block and append a citation paragraph to it.
 *
 * @param ws - Workspace of the scaffolded project.
 * @param citation - Pandoc citation written into the block body.
 * @returns Absolute path of the block file.
 */
async function blockWithCitation(ws: NodeFsWorkspace, citation: string): Promise<string> {
  await addBlock(ws, MANUSCRIPT_DIR, 0, 'Introduction');
  const blockPath = join(dir, MANUSCRIPT_DIR, 'blocks', 'introduction.qmd');
  appendFileSync(blockPath, `\n${citation}\n`);
  return blockPath;
}

/**
 * Register temp-directory lifecycle hooks for a describe block.
 */
function useTempDir(): void {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'opendraft-cli-citekeys-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });
}

describe('runCli — validate: citekeys against article bibliography', () => {
  useTempDir();

  it('returns 1 naming the block file and the key when a block cites a key absent from references.bib', async () => {
    const ws = await scaffoldedProject();
    const blockPath = await blockWithCitation(ws, `As shown [@${UNKNOWN_KEY}].`);

    const run = runValidate(dir);

    expect(run.code).toBe(1);
    expect(run.output).toContain('introduction.qmd');
    expect(run.output).toContain(UNKNOWN_KEY);
    expect(readFileSync(blockPath, 'utf8')).toContain(UNKNOWN_KEY);
  });

  it('returns 0 when the cited keys exist in references.bib', async () => {
    const ws = await scaffoldedProject();
    await blockWithCitation(ws, `As shown [@${KNOWN_KEY}].`);

    const run = runValidate(dir);

    expect(run.code).toBe(0);
  });

  it('returns 1 with a bibliography parse error when references.bib is malformed', async () => {
    const ws = await scaffoldedProject();
    await blockWithCitation(ws, `As shown [@${KNOWN_KEY}].`);
    writeFileSync(join(dir, BIB_FILE), '@article{doe2024 title = {Missing comma}}\n');

    const run = runValidate(dir);

    expect(run.code).toBe(1);
    expect(run.output).toContain('references.bib');
    expect(run.output.toLowerCase()).toContain('parse');
  });
});
