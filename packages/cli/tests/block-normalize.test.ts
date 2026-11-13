import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

/** Protocol block shared by every fixture config. */
const PROTOCOL = `protocol:
  name: opendraft
  version: f192c95d750b6a71b49134819b08aec509790c84
  repository: https://github.com/konsulin-care/opendraft
  commit: f192c95d750b6a71b49134819b08aec509790c84`;

/**
 * Build an opendraft.yml registering the given manuscript ids.
 *
 * @param ids - Manuscript ids to register under `manuscripts/<id>`.
 * @returns Full config file text.
 */
function configWith(ids: string[]): string {
  const entries = ids.map((id) => `- id: ${id}\n  path: manuscripts/${id}`).join('\n');
  return `${PROTOCOL}\nmanuscripts:\n${entries}\n`;
}

/**
 * Write a single-manuscript project whose assembly includes one block.
 *
 * @param legacy - When true the include uses the legacy un-prefixed form.
 * @param prefixed - When true the canonical `_<short>.qmd` file exists too.
 */
function writeProject(legacy: boolean, prefixed: boolean): void {
  const include = legacy ? 'blocks/intro.qmd' : 'blocks/_intro.qmd';
  writeFileSync(join(dir, 'opendraft.yml'), configWith(['first-paper']));
  mkdirSync(join(dir, 'manuscripts', 'first-paper', 'blocks'), { recursive: true });
  writeFileSync(
    join(dir, 'manuscripts', 'first-paper', 'article.qmd'),
    `{{< include ${include} >}}\n`,
  );
  if (!prefixed) {
    writeFileSync(
      join(dir, 'manuscripts', 'first-paper', 'blocks', 'intro.qmd'),
      '# Introduction {#sec-intro .doco-section}\n',
    );
  }
  if (prefixed) {
    writeFileSync(
      join(dir, 'manuscripts', 'first-paper', 'blocks', '_intro.qmd'),
      '# Introduction {#sec-intro .doco-section}\n',
    );
  }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'opendraft-cli-block-normalize-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/**
 * Run `block normalize` against a project holding only the legacy
 * `blocks/intro.qmd`, and assert the file is renamed, the rename is
 * printed with manuscript-relative paths, and the command resolves 0.
 *
 * @returns Resolves once the command and assertions complete.
 */
async function renamesLegacyBlockAndPrintsRename(): Promise<void> {
  writeProject(true, false);

  const normalize = await runCapture(['block', 'normalize', dir]);

  expect(normalize.code).toBe(0);
  expect(normalize.output).toContain('renamed blocks/intro.qmd -> blocks/_intro.qmd');
  const blocksDir = join(dir, 'manuscripts', 'first-paper', 'blocks');
  expect(readdirSync(blocksDir)).toEqual(['_intro.qmd']);
  expect(readFileSync(join(blocksDir, '_intro.qmd'), 'utf8')).toBe(
    '# Introduction {#sec-intro .doco-section}\n',
  );
}

/**
 * Run `block normalize` when both file forms of one short exist, and
 * assert the command resolves 1, names the conflicted short `intro`,
 * and leaves both files untouched.
 *
 * @returns Resolves once the command and assertions complete.
 */
async function resolvesOneNamingConflict(): Promise<void> {
  writeProject(false, true);
  writeFileSync(
    join(dir, 'manuscripts', 'first-paper', 'blocks', 'intro.qmd'),
    '# Introduction {#sec-intro .doco-section}\n',
  );

  const normalize = await runCapture(['block', 'normalize', dir]);

  expect(normalize.code).toBe(1);
  expect(normalize.output).toContain('intro');
  const blocksDir = join(dir, 'manuscripts', 'first-paper', 'blocks');
  expect(readdirSync(blocksDir).sort()).toEqual(['_intro.qmd', 'intro.qmd']);
}

describe('runCommand — block normalize', () => {
  it(
    "renames blocks/intro.qmd to blocks/_intro.qmd, prints " +
      "'renamed blocks/intro.qmd -> blocks/_intro.qmd' and resolves 0",
    renamesLegacyBlockAndPrintsRename,
  );
  it(
    "resolves 1 and names 'intro' when blocks/intro.qmd and blocks/_intro.qmd both exist",
    resolvesOneNamingConflict,
  );
});
