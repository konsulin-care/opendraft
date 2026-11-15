import { afterEach, describe, expect, it, vi } from 'vitest';
import * as entry from '../src/index.js';
import { runCommand } from '../src/index.js';

describe('entry module exports', () => {
  it('exports runCommand and no runCli', () => {
    expect(typeof entry.runCommand).toBe('function');
    expect('runCli' in entry).toBe(false);
  });
});

/** Result of one captured runCommand call, split by stream. */
interface Captured {
  /** Exit code resolved by runCommand. */
  code: number;
  /** Everything printed to stdout. */
  stdout: string;
  /** Everything printed to stderr. */
  stderr: string;

}

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Run runCommand with stdout and stderr captured separately.
 *
 * @param args - Arguments passed to runCommand.
 * @returns Promise of the resolved exit code plus both output streams.
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
    return { code: await runCommand(args), stdout: out.join('\n'), stderr: err.join('\n') };
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
}

describe('runCommand — usage', () => {
  it('resolves 0 and prints the usage for --help', async () => {
    const run = await capture(['--help']);

    expect(run.code).toBe(0);
    expect(run.stdout).toContain('usage: opendraft');
    for (const command of ['validate', 'init', 'manuscript', 'block']) {
      expect(run.stdout).toContain(command);
    }
  });

  it('resolves 2 for an unknown command', async () => {
    const run = await capture(['nope']);

    expect(run.code).toBe(2);
    expect(run.stderr).toContain('usage');
  });
});
