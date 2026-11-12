import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addBlock, scaffoldProject } from '@opendraft/manuscript';
import type { ProtocolBlock } from '@opendraft/manuscript';
import { NodeFsWorkspace } from '@opendraft/workspace/node';
import { runCli } from '../src/index.js';
import { EMBEDDED_PROTOCOL_COMMIT } from '../src/protocol.js';

/** Protocol block accepted by the opendraft.yml schema (pinned to the embedded commit). */
const PROTOCOL: ProtocolBlock = {
  name: 'opendraft',
  version: EMBEDDED_PROTOCOL_COMMIT,
  repository: 'https://github.com/konsulin-care/opendraft',
  commit: EMBEDDED_PROTOCOL_COMMIT,
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
function capture(args: string[]): Captured {
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
    return { code: runCli(args), stdout: out.join('\n'), stderr: err.join('\n') };
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
}

/**
 * Scaffold a valid project with one block in the temp directory.
 *
 * @returns Workspace adapter rooted at the temp directory.
 */
async function scaffoldedProject(): Promise<NodeFsWorkspace> {
  const ws = new NodeFsWorkspace(dir);
  await scaffoldProject(ws, { manuscriptId: 'demo', protocol: PROTOCOL });
  await addBlock(ws, MANUSCRIPT_DIR, 0, 'Introduction');
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

    const run = capture(['validate', dir, '--json']);

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
    await ws.writeFile(`${MANUSCRIPT_DIR}/blocks/scratch.qmd`, '# Scratch {#sec-scratch}\n');

    const run = capture(['validate', dir, '--json']);

    expect(run.code).toBe(0);
    expect(run.stderr).toBe('');
    const report: JsonReport = JSON.parse(run.stdout);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toHaveLength(1);
    expect(report.warnings[0].message).toContain('orphan');
  });
});

describe('runCli — validate human-readable output', () => {
  it('writes finding lines to stderr and a pass line to stdout on success', async () => {
    const ws = await scaffoldedProject();
    await ws.writeFile(`${MANUSCRIPT_DIR}/blocks/scratch.qmd`, '# Scratch {#sec-scratch}\n');

    const json = capture(['validate', dir, '--json']);
    const human = capture(['validate', dir]);

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

    const json = capture(['validate', dir, '--json']);
    const human = capture(['validate', dir]);

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
  it('--help prints usage naming every command and exits 0', () => {
    const run = capture(['--help']);

    expect(run.code).toBe(0);
    for (const command of ['validate', 'init', 'manuscript', 'block']) {
      expect(run.stdout).toContain(command);
    }
  });

  it('an unknown command prints usage and exits 2', () => {
    const run = capture(['frobnicate']);

    expect(run.code).toBe(2);
    expect(run.stderr).toContain('usage');
    expect(run.stdout).toBe('');
  });
});
