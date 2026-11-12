import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
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

describe('runCli — manuscript add', () => {
  it('manuscript add <id> creates the manuscript and registers it in opendraft.yml with exit 0', async () => {
    writeFileSync(join(dir, 'opendraft.yml'), CONFIG);

    const add = runCapture(['manuscript', 'add', 'second-paper', dir]);

    expect(add.code).toBe(0);
    await vi.waitFor(() => {
      const config = parse(readFileSync(join(dir, 'opendraft.yml'), 'utf8')) as {
        manuscripts: { id: string; path: string }[];
      };
      expect(config.manuscripts).toContainEqual({
        id: 'second-paper',
        path: 'manuscripts/second-paper',
      });
    });
    expect(existsSync(join(dir, 'manuscripts', 'second-paper', 'article.qmd'))).toBe(true);
    expect(existsSync(join(dir, 'manuscripts', 'second-paper', '_author.yml'))).toBe(true);
  });

  it('manuscript add returns 1 for a duplicate id without writing', () => {
    writeFileSync(join(dir, 'opendraft.yml'), CONFIG);
    const filesBefore = readdirSync(dir);
    const configBefore = readFileSync(join(dir, 'opendraft.yml'), 'utf8');

    const add = runCapture(['manuscript', 'add', 'first-paper', dir]);

    expect(add.code).toBe(1);
    expect(readdirSync(dir)).toEqual(filesBefore);
    expect(readFileSync(join(dir, 'opendraft.yml'), 'utf8')).toBe(configBefore);
  });

  it('manuscript add returns 1 with a message when no opendraft.yml is found', () => {
    const add = runCapture(['manuscript', 'add', 'paper', dir]);

    expect(add.code).toBe(1);
    expect(add.output).toContain('opendraft.yml');
    expect(readdirSync(dir)).toEqual([]);
  });
});
