import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
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

/** Existing project config with one registered manuscript. */
const CONFIG = `protocol:
  name: opendraft
  version: f192c95d750b6a71b49134819b08aec509790c84
  repository: https://github.com/konsulin-care/opendraft
  commit: f192c95d750b6a71b49134819b08aec509790c84
manuscripts:
- id: first-paper
  path: manuscripts/first-paper
`;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'opendraft-cli-manuscript-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('runCommand — manuscript add', () => {
  it('manuscript add resolves 0 after manuscripts/paper/article.qmd exists and it is registered', async () => {
    writeFileSync(join(dir, 'opendraft.yml'), CONFIG);

    const add = await runCapture(['manuscript', 'add', 'paper', dir]);

    expect(add.code).toBe(0);
    expect(existsSync(join(dir, 'manuscripts', 'paper', 'article.qmd'))).toBe(true);
    expect(existsSync(join(dir, 'manuscripts', 'paper', '_author.yml'))).toBe(true);
    const config = parse(readFileSync(join(dir, 'opendraft.yml'), 'utf8')) as {
      manuscripts: { id: string; path: string }[];
    };
    expect(config.manuscripts).toContainEqual({
      id: 'paper',
      path: 'manuscripts/paper',
    });
  });

  it('manuscript add resolves 1 when the id is already registered', async () => {
    writeFileSync(join(dir, 'opendraft.yml'), CONFIG);
    const filesBefore = readdirSync(dir);
    const configBefore = readFileSync(join(dir, 'opendraft.yml'), 'utf8');

    const add = await runCapture(['manuscript', 'add', 'first-paper', dir]);

    expect(add.code).toBe(1);
    expect(readdirSync(dir)).toEqual(filesBefore);
    expect(readFileSync(join(dir, 'opendraft.yml'), 'utf8')).toBe(configBefore);
  });

  it('manuscript add resolves 1 with a message when no opendraft.yml is found', async () => {
    const add = await runCapture(['manuscript', 'add', 'paper', dir]);

    expect(add.code).toBe(1);
    expect(add.output).toContain('opendraft.yml');
    expect(readdirSync(dir)).toEqual([]);
  });
});
