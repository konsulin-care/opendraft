import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import history from '../../rdf/src/protocol-history.generated.json';
import { runCommand } from '../src/index.js';

/** Result of one captured CLI run. */
interface CliRun {
  /** Exit code resolved by runCommand. */
  code: number;
  /** Everything printed to stdout and stderr. */
  output: string;
}

let dir: string;

/**
 * Run the CLI asynchronously with console output captured.
 *
 * @param args - Arguments passed to runCommand.
 * @returns Promise of the exit code plus the combined printed output.
 */
async function runCapture(args: string[]): Promise<CliRun> {
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
    return { code: await runCommand(args), output: lines.join('\n') };
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'opendraft-cli-init-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('runCommand — init', () => {
  it('init resolves 0 after opendraft.yml and manuscripts/paper/article.qmd exist', async () => {
    const init = await runCapture(['init', dir, '--manuscript', 'paper']);

    expect(init.code).toBe(0);
    expect(existsSync(join(dir, 'opendraft.yml'))).toBe(true);
    expect(existsSync(join(dir, 'manuscripts', 'paper', 'article.qmd'))).toBe(true);

    const validate = await runCapture(['validate', dir]);
    // A scaffold has no authors/abstract, so validate reports findings (exit 1) but not a usage error.
    expect(validate.code).not.toBe(2);
    expect(validate.output).not.toContain('blocks/');
  });

  it('init pins protocol version and commit to the bundled history latest', async () => {
    const latest = (history as unknown as { latest: string }).latest;
    await runCapture(['init', dir, '--manuscript', 'paper']);
    const yml = readFileSync(join(dir, 'opendraft.yml'), 'utf8');

    expect(yml).toMatch(new RegExp(`^\\s*version:\\s*"?${latest}"?\\s*$`, 'm'));
    expect(yml).toMatch(new RegExp(`^\\s*commit:\\s*"?${latest}"?\\s*$`, 'm'));
  });

  it('init resolves 1 and writes nothing when the target already contains opendraft.yml', async () => {
    const sentinel = 'protocol:\n  name: opendraft\n';
    writeFileSync(join(dir, 'opendraft.yml'), sentinel);

    const init = await runCapture(['init', dir, '--manuscript', 'paper']);

    expect(init.code).toBe(1);
    expect(readdirSync(dir)).toEqual(['opendraft.yml']);
    expect(readFileSync(join(dir, 'opendraft.yml'), 'utf8')).toBe(sentinel);
  });

  it('init resolves 1 for an invalid manuscript id', async () => {
    const init = await runCapture(['init', dir, '--manuscript', 'Not A Slug']);

    expect(init.code).toBe(1);
  });
});
