import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCli } from '../src/index.js';

/** Result of one captured CLI run. */
interface CliRun {
  /** Exit code returned by runCli. */
  code: number;
  /** Everything printed to stdout and stderr. */
  output: string;
}

let dir: string;

/**
 * Run the CLI with console output captured.
 *
 * @param args - Arguments passed to runCli.
 * @returns Exit code plus the combined printed output.
 */
function runCapture(args: string[]): CliRun {
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
    return { code: runCli(args), output: lines.join('\n') };
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
}

/**
 * Wait until the scaffolded project is fully written.
 *
 * `init` dispatches its workspace writes without blocking runCli, so the
 * test waits for references.bib — the last file the scaffold writes —
 * before validating the project.
 */
async function waitForScaffold(): Promise<void> {
  await vi.waitFor(() => {
    expect(existsSync(join(dir, 'manuscripts', 'references.bib'))).toBe(true);
  });
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'opendraft-cli-init-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('runCli — init', () => {
  it('init <dir> --manuscript paper creates a project that validate accepts with exit 0', async () => {
    const init = runCapture(['init', dir, '--manuscript', 'paper']);

    expect(init.code).toBe(0);
    await waitForScaffold();

    const validate = runCapture(['validate', dir]);
    expect(validate.code).toBe(0);
  });

  it('init returns 1 and writes nothing when the target already contains opendraft.yml', () => {
    const sentinel = 'protocol:\n  name: opendraft\n';
    writeFileSync(join(dir, 'opendraft.yml'), sentinel);

    const init = runCapture(['init', dir, '--manuscript', 'paper']);

    expect(init.code).toBe(1);
    expect(readdirSync(dir)).toEqual(['opendraft.yml']);
    expect(readFileSync(join(dir, 'opendraft.yml'), 'utf8')).toBe(sentinel);
  });

  it('init returns 1 for an invalid manuscript id', () => {
    const init = runCapture(['init', dir, '--manuscript', 'Not A Slug']);

    expect(init.code).toBe(1);
  });
});
