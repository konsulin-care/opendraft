import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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

/** Container assembly with no include shortcodes, mirroring the scaffold. */
const CONTAINER = `---
metadata-files:
- _author.yml
- _abstract.yml
- _frontmatter.yml
bibliography: ../references.bib
---

::: {#refs}
:::
`;

/**
 * Write a project config and one manuscript's article plus empty blocks dir.
 *
 * @param ids - Manuscript ids listed in opendraft.yml.
 * @param articleId - Id whose article.qmd and blocks/ directory are created.
 * @param article - Assembly text written to that article.qmd.
 */
function writeProject(ids: string[], articleId: string, article: string): void {
  writeFileSync(join(dir, 'opendraft.yml'), configWith(ids));
  mkdirSync(join(dir, 'manuscripts', articleId, 'blocks'), { recursive: true });
  writeFileSync(join(dir, 'manuscripts', articleId, 'article.qmd'), article);
}

/**
 * Extract the block short names from an assembly, in include order.
 *
 * @param article - Full article.qmd text.
 * @returns One short name per include line.
 */
function includesOf(article: string): string[] {
  const shorts: string[] = [];
  for (const line of article.split('\n')) {
    const match = /\{\{< include\s+blocks\/([a-z0-9-]+)\.qmd\s*>\}\}/.exec(line.trim());
    if (match !== null) shorts.push(match[1]);
  }
  return shorts;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'opendraft-cli-block-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/**
 * Run `block add Methods` in a single-manuscript project and assert the
 * block heading is written and its include appended.
 *
 * @returns Resolves once the asynchronous write and assertions complete.
 */
async function writesBlockAndAppendsInclude(): Promise<void> {
  writeProject(['first-paper'], 'first-paper', CONTAINER);

  const add = runCapture(['block', 'add', 'Methods', dir]);

  expect(add.code).toBe(0);
  await vi.waitFor(() => {
    const block = readFileSync(
      join(dir, 'manuscripts', 'first-paper', 'blocks', 'methods.qmd'),
      'utf8',
    );
    expect(block).toBe('# Methods {#sec-methods .doco-section}\n');
    const article = readFileSync(join(dir, 'manuscripts', 'first-paper', 'article.qmd'), 'utf8');
    expect(includesOf(article)).toEqual(['methods']);
  });
}

/**
 * Run `block add Methods --after intro --type methods` against a project
 * that already includes an intro block, and assert include placement and
 * the `.deo-methods` class on the heading.
 *
 * @returns Resolves once the asynchronous write and assertions complete.
 */
async function insertsAfterAndAppliesType(): Promise<void> {
  const withIntro = CONTAINER.replace(
    '\n::: {#refs}',
    '\n{{< include blocks/intro.qmd >}}\n\n::: {#refs}',
  );
  writeProject(['first-paper', 'second-paper'], 'first-paper', withIntro);
  writeFileSync(
    join(dir, 'manuscripts', 'first-paper', 'blocks', 'intro.qmd'),
    '# Introduction {#sec-intro .doco-section}\n',
  );

  const add = runCapture([
    'block',
    'add',
    'Methods',
    dir,
    '-m',
    'first-paper',
    '--after',
    'intro',
    '--type',
    'methods',
  ]);

  expect(add.code).toBe(0);
  await vi.waitFor(() => {
    const article = readFileSync(join(dir, 'manuscripts', 'first-paper', 'article.qmd'), 'utf8');
    expect(includesOf(article)).toEqual(['intro', 'methods']);
    const block = readFileSync(
      join(dir, 'manuscripts', 'first-paper', 'blocks', 'methods.qmd'),
      'utf8',
    );
    expect(block).toBe('# Methods {#sec-methods .deo-methods}\n');
  });
}

/**
 * Run `block add` without `-m` in a two-manuscript project and assert the
 * failure lists both manuscript ids without writing any file.
 *
 * @returns Nothing; assertions run synchronously.
 */
function returnsOneListingManuscripts(): void {
  writeFileSync(join(dir, 'opendraft.yml'), configWith(['first-paper', 'second-paper']));

  const add = runCapture(['block', 'add', 'Methods', dir]);

  expect(add.code).toBe(1);
  expect(add.output).toContain('first-paper');
  expect(add.output).toContain('second-paper');
  expect(readdirSync(dir)).toEqual(['opendraft.yml']);
}

describe('runCli — block add', () => {
  it(
    'writes blocks/methods.qmd with its heading and appends its include in a single-manuscript project',
    writesBlockAndAppendsInclude,
  );
  it(
    '--after <short> inserts the include after that block and --type methods writes the .deo-methods class',
    insertsAfterAndAppliesType,
  );
  it(
    'returns 1 listing the manuscript ids when run without -m in a two-manuscript project',
    returnsOneListingManuscripts,
  );
});
