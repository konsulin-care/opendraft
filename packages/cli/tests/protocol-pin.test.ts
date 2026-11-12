import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scaffoldProject } from '@opendraft/manuscript';
import type { ProtocolBlock } from '@opendraft/manuscript';
import { NodeFsWorkspace } from '@opendraft/workspace/node';
import { runCli } from '../src/index.js';
import { EMBEDDED_PROTOCOL_COMMIT } from '../src/protocol.js';

/** Protocol block accepted by the opendraft.yml schema. */
const PROTOCOL: ProtocolBlock = {
  name: 'opendraft',
  version: 'e849ba8a46528d523d5f3d18f5f0171853f13030',
  repository: 'https://github.com/konsulin-care/opendraft',
  commit: 'e849ba8a46528d523d5f3d18f5f0171853f13030',
};

/** A 40-character commit SHA guaranteed to differ from the embedded one. */
const MISMATCH_COMMIT = `${EMBEDDED_PROTOCOL_COMMIT.slice(0, 39)}${
  EMBEDDED_PROTOCOL_COMMIT.endsWith('0') ? '1' : '0'
}`;

/** Result of one captured CLI run, split by stream. */
interface Captured {
  /** Exit code returned by runCli. */
  code: number;
  /** Everything printed to stdout. */
  stdout: string;
  /** Everything printed to stderr. */
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
 * Scaffold a project rooted at the temp directory with the given pin.
 *
 * @param protocol - Protocol block written into opendraft.yml.
 * @returns Workspace adapter rooted at the temp directory.
 */
async function scaffoldedProject(protocol: ProtocolBlock): Promise<NodeFsWorkspace> {
  const ws = new NodeFsWorkspace(dir);
  await scaffoldProject(ws, { manuscriptId: 'demo', protocol });
  return ws;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'opendraft-cli-pin-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('runCli — validate: protocol pin', () => {
  it('embeds the protocol commit from protocol/protocol.manifest.json', () => {
    const manifestPath = fileURLToPath(
      new URL('../../../protocol/protocol.manifest.json', import.meta.url),
    );
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      protocol: { commit: string };
    };

    expect(EMBEDDED_PROTOCOL_COMMIT).toBe(manifest.protocol.commit);
  });

  it('warns without changing the exit code when opendraft.yml protocol.commit differs from the embedded commit', async () => {
    await scaffoldedProject({ ...PROTOCOL, version: MISMATCH_COMMIT, commit: MISMATCH_COMMIT });

    const json = capture(['validate', dir, '--json']);
    const human = capture(['validate', dir]);

    expect(json.code).toBe(0);
    const report: JsonReport = JSON.parse(json.stdout);
    expect(report.errors).toEqual([]);
    expect(
      report.warnings.some(
        (finding) => finding.path === 'protocol.commit' && finding.message.includes(MISMATCH_COMMIT),
      ),
    ).toBe(true);
    expect(human.code).toBe(0);
    expect(human.stderr).toContain('protocol.commit');
    expect(human.stderr).toContain(MISMATCH_COMMIT);
  });

  it('reports no protocol warning when the commits match', async () => {
    await scaffoldedProject({
      ...PROTOCOL,
      version: EMBEDDED_PROTOCOL_COMMIT,
      commit: EMBEDDED_PROTOCOL_COMMIT,
    });

    const json = capture(['validate', dir, '--json']);
    const human = capture(['validate', dir]);

    expect(json.code).toBe(0);
    const report: JsonReport = JSON.parse(json.stdout);
    expect(report.errors).toEqual([]);
    expect(report.warnings.some((finding) => finding.path === 'protocol.commit')).toBe(false);
    expect(human.code).toBe(0);
    expect(human.stderr).not.toContain('protocol.commit');
  });
});
