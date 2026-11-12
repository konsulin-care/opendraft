import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
 * Register temp-directory lifecycle hooks for a describe block.
 */
function useTempDir(): void {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'opendraft-cli-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });
}

describe('runCli — validate: config and metadata', () => {
  useTempDir();

  it('returns 0 for a project built with scaffoldProject plus addBlock', async () => {
    const ws = await scaffoldedProject();
    await addBlock(ws, MANUSCRIPT_DIR, 0, 'Introduction');

    const run = runValidate(dir);

    expect(run.code).toBe(0);
  });

  it('returns 1 and names opendraft.yml when the config is invalid', async () => {
    await scaffoldedProject();
    writeFileSync(join(dir, 'opendraft.yml'), 'protocol:\n  name: opendraft\n');

    const run = runValidate(dir);

    expect(run.code).toBe(1);
    expect(run.output).toContain('opendraft.yml');
  });

  it('returns 1 and names _frontmatter.yml when frontmatter is invalid', async () => {
    await scaffoldedProject();
    writeFileSync(join(dir, MANUSCRIPT_DIR, '_frontmatter.yml'), 'keywords: []\n');

    const run = runValidate(dir);

    expect(run.code).toBe(1);
    expect(run.output).toContain('_frontmatter.yml');
  });
});

describe('runCli — validate: assembly', () => {
  useTempDir();

  it('returns 1 when the assembly includes a missing block file', async () => {
    const ws = await scaffoldedProject();
    await addBlock(ws, MANUSCRIPT_DIR, 0, 'Introduction');
    const articlePath = join(dir, MANUSCRIPT_DIR, 'article.qmd');
    const article = readFileSync(articlePath, 'utf8');
    writeFileSync(
      articlePath,
      article.replace('::: {#refs}', '{{< include blocks/ghost.qmd >}}\n::: {#refs}'),
    );

    const run = runValidate(dir);

    expect(run.code).toBe(1);
    expect(run.output).toContain('ghost.qmd');
  });

  it('returns 1 when two included blocks share the same sec anchor', async () => {
    const ws = await scaffoldedProject();
    await addBlock(ws, MANUSCRIPT_DIR, 0, 'Introduction');
    await addBlock(ws, MANUSCRIPT_DIR, 1, 'Methods');
    writeFileSync(
      join(dir, MANUSCRIPT_DIR, 'blocks', 'methods.qmd'),
      '# Methods {#sec-introduction}\n',
    );

    const run = runValidate(dir);

    expect(run.code).toBe(1);
    expect(run.output).toContain('sec-introduction');
  });

  it('reports an orphan block file as a warning and returns 0', async () => {
    const ws = await scaffoldedProject();
    await addBlock(ws, MANUSCRIPT_DIR, 0, 'Introduction');
    await ws.writeFile(`${MANUSCRIPT_DIR}/blocks/scratch.qmd`, '# Scratch {#sec-scratch}\n');

    const run = runValidate(dir);

    expect(run.code).toBe(0);
    expect(run.output.toLowerCase()).toContain('orphan');
    expect(run.output).toContain('scratch.qmd');
  });
});
