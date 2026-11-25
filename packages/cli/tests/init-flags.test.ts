import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initCommand } from '../src/commands/init.js';

/** Result of one captured command run, split by stream. */
interface Captured {
  /** Exit code resolved by the command. */
  code: number;
  /** Everything printed to stdout. */
  stdout: string;
  /** Everything printed to stderr. */
  stderr: string;
}

let dir: string;

/**
 * Write a registrable legacy manuscript directly into the temp project.
 *
 * @param id - Manuscript folder name.
 */
function writeManuscript(id: string): void {
  const path = join(dir, 'manuscripts', id);
  mkdirSync(path, { recursive: true });
  const article = `---
metadata-files:
- _author.yml
- _abstract.yml
- _frontmatter.yml
bibliography: ../references.bib
---

::: {#refs}
:::
`;
  writeFileSync(join(path, 'article.qmd'), article);
  writeFileSync(join(path, '_author.yml'), 'authors: []\naffiliations: []\n');
  writeFileSync(join(path, '_abstract.yml'), 'abstract: ""\n');
  writeFileSync(join(path, '_frontmatter.yml'), 'title: "Existing"\n');
}

/**
 * Write a valid project configuration listing one manuscript.
 *
 * @param id - Manuscript id to list.
 * @returns The configuration text written.
 */
function writeConfig(id: string): string {
  const revision = 'e849ba8a46528d523d5f3d18f5f0171853f13030';
  const config = `protocol:
  name: opendraft
  version: ${revision}
  repository: https://github.com/konsulin-care/opendraft
  commit: ${revision}
manuscripts:
  - id: ${id}
    path: manuscripts/${id}
`;
  writeFileSync(join(dir, 'opendraft.yml'), config);
  writeFileSync(join(dir, 'references.bib'), '@book{example}\n');
  return config;
}

/**
 * Run initCommand with stdout and stderr captured separately.
 *
 * @param args - Arguments passed to initCommand.
 * @param interactive - Whether the interaction surface accepts prompts.
 * @returns Promise of the resolved exit code plus both output streams.
 */
async function capture(args: string[], interactive = false): Promise<Captured> {
  const out: string[] = [];
  const err: string[] = [];
  const spies = [
    vi.spyOn(console, 'log').mockImplementation((...data: unknown[]) => {
      out.push(data.map(String).join(' '));
    }),
    vi.spyOn(console, 'error').mockImplementation((...data: unknown[]) => {
      err.push(data.map(String).join(' '));
    }),
  ];
  try {
    const code = await initCommand(args, {
      interactive,
      ask: () => Promise.resolve('n'),
    });
    return { code, stdout: out.join('\n'), stderr: err.join('\n') };
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'opendraft-cli-flags-'));
  writeManuscript('paper');
  writeConfig('paper');
  writeManuscript('case-series-review');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('init — --yes', () => {
  it('registers unlisted folders and keeps the protocol block', async () => {
    const run = await capture([dir, '--yes']);

    expect(run.code).toBe(0);
    const yml = readFileSync(join(dir, 'opendraft.yml'), 'utf8');
    expect(yml).toContain('case-series-review');
    expect(yml).toContain('protocol:');
    expect(yml).toContain('e849ba8a46528d523d5f3d18f5f0171853f13030');
  });

  it('exits 2 and changes nothing without --yes in non-interactive mode', async () => {
    const before = readFileSync(join(dir, 'opendraft.yml'), 'utf8');

    const run = await capture([dir]);

    expect(run.code).toBe(2);
    expect(run.stdout).toContain('case-series-review');
    expect(run.stderr).toContain('--yes');
    expect(readFileSync(join(dir, 'opendraft.yml'), 'utf8')).toBe(before);
  });
});

describe('init — --dry-run', () => {
  it('prints the planned configuration path and writes nothing', async () => {
    const before = readFileSync(join(dir, 'opendraft.yml'), 'utf8');

    const run = await capture([dir, '--yes', '--dry-run']);

    expect(run.code).toBe(0);
    expect(run.stdout).toContain('opendraft.yml');
    expect(run.stdout).toContain('update');
    expect(readFileSync(join(dir, 'opendraft.yml'), 'utf8')).toBe(before);
  });
});

describe('init — discovery without unlisted folders', () => {
  it('still reports nothing to do', async () => {
    rmSync(join(dir, 'manuscripts', 'case-series-review'), { recursive: true, force: true });

    const run = await capture([dir, '--yes']);

    expect(run.code).toBe(0);
    expect(run.stdout).toContain('nothing to do');
    expect(existsSync(join(dir, 'opendraft.yml'))).toBe(true);
  });
});
