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
import history from '../../rdf/src/protocol-history.generated.json';
import { initCommand } from '../src/commands/init.js';
import { runCommand } from '../src/index.js';

/** Result of one captured CLI run. */
interface CliRun {
  /** Exit code resolved by the command. */
  code: number;
  /** Everything printed to stdout and stderr. */
  output: string;
}

let dir: string;

/**
 * Capture console output while running one command.
 *
 * @param run - Command promise factory executed with output captured.
 * @returns Promise of the exit code plus the combined printed output.
 */
async function captureRun(run: () => Promise<number>): Promise<CliRun> {
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
    return { code: await run(), output: lines.join('\n') };
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
}

/**
 * Run the CLI asynchronously with console output captured.
 *
 * @param args - Arguments passed to runCommand.
 * @returns Promise of the exit code plus the combined printed output.
 */
async function runCapture(args: string[]): Promise<CliRun> {
  return captureRun(() => runCommand(args));
}

/**
 * Write a registrable legacy manuscript directly into the temp project.
 *
 * @param id - Manuscript folder name.
 * @returns Paths plus the article and author bytes for identity assertions.
 */
function writeManuscript(id: string): { article: string; author: string; path: string } {
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
  const author = 'authors: []\naffiliations: []\n';
  writeFileSync(join(path, 'article.qmd'), article);
  writeFileSync(join(path, '_author.yml'), author);
  writeFileSync(join(path, '_abstract.yml'), 'abstract: ""\n');
  writeFileSync(join(path, '_frontmatter.yml'), 'title: "Existing"\n');
  return { article, author, path };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'opendraft-cli-init-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('runCommand — init discovery', () => {
  it('init registers an existing valid manuscript without touching its files', async () => {
    const existing = writeManuscript('case-series-review');

    const init = await runCapture(['init', dir]);

    expect(init.code).toBe(0);
    expect(existsSync(join(dir, 'opendraft.yml'))).toBe(true);
    expect(readFileSync(join(dir, 'opendraft.yml'), 'utf8')).toContain('case-series-review');
    expect(readFileSync(join(existing.path, 'article.qmd'), 'utf8')).toBe(existing.article);
    expect(readFileSync(join(existing.path, '_author.yml'), 'utf8')).toBe(existing.author);
  });

  it('init resolves 0 after opendraft.yml and manuscripts/paper/article.qmd exist', async () => {
    const init = await runCapture(['init', dir, '--manuscript', 'paper']);

    expect(init.code).toBe(0);
    expect(existsSync(join(dir, 'opendraft.yml'))).toBe(true);
    expect(existsSync(join(dir, 'manuscripts', 'paper', 'article.qmd'))).toBe(true);

    const validate = await runCapture(['validate', dir]);
    // A scaffold has no authors/abstract, so validate reports warnings but no errors.
    expect(validate.code).toBe(0);
    expect(validate.output).not.toContain('blocks/');
  });

  it('a freshly initialized project validates offline with exit code 0', async () => {
    await runCapture(['init', dir, '--manuscript', 'paper']);

    const validate = await runCapture(['validate', dir, '--offline']);

    expect(validate.code).toBe(0);
    expect(validate.output).not.toContain('A publication must have at least one creator.');
  });

});

describe('runCommand — init scaffolding', () => {
  it('init pins protocol version and commit to the bundled history latest', async () => {
    const latest = (history as unknown as { latest: string }).latest;
    await runCapture(['init', dir, '--manuscript', 'paper']);
    const yml = readFileSync(join(dir, 'opendraft.yml'), 'utf8');

    expect(yml).toMatch(new RegExp(`^\\s*version:\\s*"?${latest}"?\\s*$`, 'm'));
    expect(yml).toMatch(new RegExp(`^\\s*commit:\\s*"?${latest}"?\\s*$`, 'm'));
  });

  it('init resolves 0 with nothing to do when a configured project has no unlisted folders', async () => {
    await runCapture(['init', dir, '--manuscript', 'paper']);
    const before = readFileSync(join(dir, 'opendraft.yml'), 'utf8');

    const init = await runCapture(['init', dir]);

    expect(init.code).toBe(0);
    expect(init.output).toContain('nothing to do');
    expect(readFileSync(join(dir, 'opendraft.yml'), 'utf8')).toBe(before);
  });

});

describe('runCommand — init fallbacks', () => {
  it('init resolves 1 for an invalid manuscript id', async () => {
    const init = await runCapture(['init', dir, '--manuscript', 'Not A Slug']);

    expect(init.code).toBe(1);
  });

  it('init exits 2 without --manuscript when non-interactive and no candidates exist', async () => {
    const init = await captureRun(() =>
      initCommand([dir], {
        interactive: false,
        ask: () => Promise.resolve('ignored'),
      }),
    );

    expect(init.code).toBe(2);
    expect(init.output).toContain('--manuscript');
  });

  it('init scaffolds manuscript/paper when --manuscript is given and no candidates exist', async () => {
    const init = await captureRun(() =>
      initCommand([dir, '--manuscript', 'paper'], {
        interactive: false,
        ask: () => Promise.resolve('ignored'),
      }),
    );

    expect(init.code).toBe(0);
    expect(existsSync(join(dir, 'manuscripts', 'paper', 'article.qmd'))).toBe(true);
  });
});
