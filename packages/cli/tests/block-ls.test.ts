import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'opendraft-cli-block-ls-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/**
 * Run `block ls` against a project whose article.qmd includes three
 * blocks out of alphabetical order and assert one `short<TAB>title`
 * line per include, in include order.
 *
 * @returns Resolves once the command and assertions complete.
 */
async function printsShortTitlePerInclude(): Promise<void> {
  const article = [
    '---',
    'metadata-files:',
    '- _author.yml',
    '---',
    '',
    '{{< include blocks/_methods.qmd >}}',
    '',
    '{{< include blocks/_intro.qmd >}}',
    '',
    '{{< include blocks/_discussion.qmd >}}',
    '',
    '::: {#refs}',
    ':::',
    '',
  ].join('\n');
  writeFileSync(join(dir, 'opendraft.yml'), configWith(['first-paper']));
  mkdirSync(join(dir, 'manuscripts', 'first-paper', 'blocks'), { recursive: true });
  writeFileSync(join(dir, 'manuscripts', 'first-paper', 'article.qmd'), article);
  writeFileSync(
    join(dir, 'manuscripts', 'first-paper', 'blocks', '_methods.qmd'),
    '# Methods {#sec-methods .doco-section}\n',
  );
  writeFileSync(
    join(dir, 'manuscripts', 'first-paper', 'blocks', '_intro.qmd'),
    '# Introduction {#sec-intro .doco-section}\n',
  );
  writeFileSync(
    join(dir, 'manuscripts', 'first-paper', 'blocks', '_discussion.qmd'),
    '# Discussion {#sec-discussion .doco-section}\n',
  );

  const ls = await runCapture(['block', 'ls', dir]);

  expect(ls.code).toBe(0);
  expect(ls.output.split('\n')).toEqual([
    'methods\tMethods',
    'intro\tIntroduction',
    'discussion\tDiscussion',
  ]);
}

/**
 * Run `block ls` against a project that still uses legacy un-prefixed
 * block files, and assert each include resolves to its on-disk file.
 *
 * @returns Resolves once the command and assertions complete.
 */
async function resolvesLegacyBlockFiles(): Promise<void> {
  const article = ['{{< include blocks/methods.qmd >}}', '', '{{< include blocks/intro.qmd >}}', '']
    .join('\n');
  writeFileSync(join(dir, 'opendraft.yml'), configWith(['first-paper']));
  mkdirSync(join(dir, 'manuscripts', 'first-paper', 'blocks'), { recursive: true });
  writeFileSync(join(dir, 'manuscripts', 'first-paper', 'article.qmd'), article);
  writeFileSync(
    join(dir, 'manuscripts', 'first-paper', 'blocks', 'methods.qmd'),
    '# Methods {#sec-methods .doco-section}\n',
  );
  writeFileSync(
    join(dir, 'manuscripts', 'first-paper', 'blocks', 'intro.qmd'),
    '# Introduction {#sec-intro .doco-section}\n',
  );

  const ls = await runCapture(['block', 'ls', dir]);

  expect(ls.code).toBe(0);
  expect(ls.output.split('\n')).toEqual(['methods\tMethods', 'intro\tIntroduction']);
}

/**
 * Run `block ls -m <unknown-id>` against a valid project and assert the
 * exit code is 1 and the printed error names that id.
 *
 * @returns Resolves once the command and assertions complete.
 */
async function returnsOneNamingUnknownId(): Promise<void> {
  writeFileSync(join(dir, 'opendraft.yml'), configWith(['first-paper']));

  const ls = await runCapture(['block', 'ls', dir, '-m', 'ghost-paper']);

  expect(ls.code).toBe(1);
  expect(ls.output).toContain('ghost-paper');
}

describe('runCommand — block ls', () => {
  it(
    "prints one 'short<TAB>title' line per block in include order",
    printsShortTitlePerInclude,
  );
  it('resolves legacy un-prefixed block files through the resolved file', resolvesLegacyBlockFiles);
  it('returns 1 naming the unknown id passed with -m', returnsOneNamingUnknownId);
});
