import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addBlock, scaffoldProject } from '@opendraft/manuscript';
import type { ProtocolBlock } from '@opendraft/manuscript';
import { NodeFsWorkspace } from '@opendraft/workspace/node';
import { runCommand } from '../src/index.js';

/** Protocol block accepted by the opendraft.yml schema (unbundled pin: RDF stage skipped offline). */
const PROTOCOL: ProtocolBlock = {
  name: 'opendraft',
  version: 'e849ba8a46528d523d5f3d18f5f0171853f13030',
  repository: 'https://github.com/konsulin-care/opendraft',
  commit: 'e849ba8a46528d523d5f3d18f5f0171853f13030',
};

/** Manuscript directory written by the scaffold for id `demo`. */
const MANUSCRIPT_DIR = 'manuscripts/demo';

/** Result of one captured CLI run, split by stream. */
interface Captured {
  /** Exit code returned by runCli. */
  code: number;
  /** Everything printed to stdout. */
  stdout: string;
  /** Everything printed to stderr (including warnings). */
  stderr: string;
}

/** One finding as it appears in the `--json` report. */
interface JsonFinding {
  location: string;
  path: string;
  message: string;
}

/** The `--json` report written to stdout. */
interface JsonReport {
  errors: JsonFinding[];
  warnings: JsonFinding[];
}

let dir: string;

/**
 * Run the CLI with stdout and stderr captured separately.
 *
 * @param args - Arguments passed to runCli.
 * @returns Exit code plus the two output streams.
 */
async function capture(args: string[]): Promise<Captured> {
  const out: string[] = [];
  const err: string[] = [];
  const push = (sink: string[]) => (...data: unknown[]): void => {
    sink.push(data.map(String).join(' '));
  };
  const spies = [
    vi.spyOn(console, 'log').mockImplementation(push(out)),
    vi.spyOn(console, 'error').mockImplementation(push(err)),
    vi.spyOn(console, 'warn').mockImplementation(push(err)),
  ];
  try {
    const code = await runCommand(args);
    return { code, stdout: out.join('\n'), stderr: err.join('\n') };
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
}

/**
 * Migrate addBlock's legacy block fixtures to the prefixed layout.
 *
 * Renames every un-prefixed `blocks/<short>.qmd` to `blocks/_<short>.qmd`
 * and rewrites the matching include lines in `article.qmd`, so the seeded
 * project follows the `blocks/_<short>.qmd` convention.
 *
 * @param ws - Workspace of the scaffolded project.
 * @returns Resolves once every block file and include line is prefixed.
 */
async function normalizeBlockFixtures(ws: NodeFsWorkspace): Promise<void> {
  const blocksDir = `${MANUSCRIPT_DIR}/blocks`;
  const articlePath = `${MANUSCRIPT_DIR}/article.qmd`;
  for (const file of await ws.listFiles(blocksDir)) {
    if (file.startsWith('_') || !file.endsWith('.qmd')) continue;
    const content = await ws.readFile(`${blocksDir}/${file}`);
    await ws.writeFile(`${blocksDir}/_${file}`, content ?? '');
    await ws.deleteFile(`${blocksDir}/${file}`);
    const short = file.replace(/\.qmd$/, '');
    const article = (await ws.readFile(articlePath)) ?? '';
    await ws.writeFile(
      articlePath,
      article.replaceAll(`blocks/${short}.qmd`, `blocks/_${short}.qmd`),
    );
  }
}

/**
 * Scaffold a valid project with one prefixed block in the temp directory.
 *
 * @returns Workspace adapter rooted at the temp directory.
 */
async function scaffoldedProject(): Promise<NodeFsWorkspace> {
  const ws = new NodeFsWorkspace(dir);
  await scaffoldProject(ws, { manuscriptId: 'demo', protocol: PROTOCOL });
  await addBlock(ws, MANUSCRIPT_DIR, 0, 'Introduction');
  await normalizeBlockFixtures(ws);
  return ws;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'opendraft-cli-output-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('runCli — validate --json', () => {
  it('writes one JSON object with errors and warnings to stdout', async () => {
    await scaffoldedProject();
    writeFileSync(join(dir, 'opendraft.yml'), 'protocol:\n  name: opendraft\n');

    const run = await capture(['validate', dir, '--json', '--offline']);

    expect(run.code).toBe(1);
    const report: JsonReport = JSON.parse(run.stdout);
    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.warnings).toEqual([]);
    for (const finding of report.errors) {
      expect(Object.keys(finding).sort()).toEqual(['location', 'message', 'path']);
      expect(typeof finding.location).toBe('string');
      expect(typeof finding.path).toBe('string');
      expect(typeof finding.message).toBe('string');
    }
  });

  it('reports warnings in JSON and keeps stderr empty', async () => {
    const ws = await scaffoldedProject();
    await ws.writeFile(`${MANUSCRIPT_DIR}/blocks/_scratch.qmd`, '# Scratch {#sec-scratch}\n');

    const run = await capture(['validate', dir, '--json', '--offline']);

    expect(run.code).toBe(0);
    expect(run.stderr).toBe('');
    const report: JsonReport = JSON.parse(run.stdout);
    expect(report.errors).toEqual([]);
    expect(report.warnings.some((w) => w.message.includes('orphan'))).toBe(true);
  });
});

describe('runCli — validate human-readable output', () => {
  it('writes finding lines to stderr and a pass line to stdout on success', async () => {
    const ws = await scaffoldedProject();
    await ws.writeFile(`${MANUSCRIPT_DIR}/blocks/_scratch.qmd`, '# Scratch {#sec-scratch}\n');

    const json = await capture(['validate', dir, '--json', '--offline']);
    const human = await capture(['validate', dir, '--offline']);

    expect(human.code).toBe(0);
    expect(human.stdout).toContain('✓ Project validation passed.');
    const report: JsonReport = JSON.parse(json.stdout);
    expect(report.errors).toHaveLength(0);
    expect(report.warnings.length).toBeGreaterThan(0);
    for (const warning of report.warnings) {
      expect(human.stderr).toContain(`${warning.location} (${warning.path}): ${warning.message}`);
    }
  });

  it('writes error finding lines to stderr without a pass line', async () => {
    await scaffoldedProject();
    writeFileSync(join(dir, 'opendraft.yml'), 'protocol:\n  name: opendraft\n');

    const json = await capture(['validate', dir, '--json', '--offline']);
    const human = await capture(['validate', dir, '--offline']);

    expect(human.code).toBe(1);
    expect(human.stdout).not.toContain('passed');
    const report: JsonReport = JSON.parse(json.stdout);
    expect(report.errors.length).toBeGreaterThan(0);
    for (const error of report.errors) {
      expect(human.stderr).toContain(`${error.location} (${error.path}): ${error.message}`);
    }
  });
});

describe('runCli — usage', () => {
  it('--help prints usage naming every command and exits 0', async () => {
    const run = await capture(['--help']);

    expect(run.code).toBe(0);
    for (const command of ['validate', 'init', 'manuscript', 'block']) {
      expect(run.stdout).toContain(command);
    }
  });

  it('an unknown command prints usage and exits 2', async () => {
    const run = await capture(['frobnicate']);

    expect(run.code).toBe(2);
    expect(run.stderr).toContain('usage');
    expect(run.stdout).toBe('');
  });
});
